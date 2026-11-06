import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import type {
  CreateFlightRequest,
  CreateVisaRequest,
  FlightDetails,
  ServiceAction,
  ServiceRequestDetail,
  ServiceStatus,
  VisaDetails,
} from "@pegah/contracts";
import { Prisma } from "@pegah/db";
import { randomInt } from "node:crypto";
import { EmailVerificationService } from "../account/email-verification.service";
import { AuditService } from "../audit/audit.service";
import type { AuthContext } from "../auth/auth.types";
import { newPublicId } from "../common/ids";
import { toMoney } from "../common/money";
import { ProblemException } from "../common/problem";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { PRISMA, type Db } from "../prisma/prisma.service";
import {
  DOCUMENT_MAX_BYTES,
  DOCUMENTS_PER_REQUEST,
  DocumentVault,
  safeFileName,
  sniffDocument,
} from "./document-vault";

type Tx = Prisma.TransactionClient;

const CLOSED: ServiceStatus[] = ["COMPLETED", "REJECTED", "CANCELLED"];
const CUSTOMER_CANCELLABLE: ServiceStatus[] = ["SUBMITTED", "NEEDS_INFO", "QUOTED"];
const CUSTOMER_REPLY: ServiceStatus[] = [
  "SUBMITTED",
  "NEEDS_INFO",
  "QUOTED",
  "PAID",
  "IN_PROGRESS",
];
const OPEN_FOR_STAFF: ServiceStatus[] = [
  "SUBMITTED",
  "NEEDS_INFO",
  "QUOTED",
  "PAID",
  "IN_PROGRESS",
];

/** Staff actions: which statuses each may start from, and where it leads. */
const ACTIONS: Record<
  Exclude<ServiceAction["action"], "NOTE">,
  { from: ServiceStatus[]; to: ServiceStatus }
> = {
  NEEDS_INFO: { from: ["SUBMITTED", "QUOTED", "PAID", "IN_PROGRESS"], to: "NEEDS_INFO" },
  QUOTE: { from: ["SUBMITTED", "NEEDS_INFO", "QUOTED"], to: "QUOTED" },
  MARK_PAID: { from: ["QUOTED"], to: "PAID" },
  START: { from: ["PAID", "NEEDS_INFO"], to: "IN_PROGRESS" },
  COMPLETE: { from: ["PAID", "IN_PROGRESS"], to: "COMPLETED" },
  REJECT: { from: OPEN_FOR_STAFF, to: "REJECTED" },
  CANCEL: { from: OPEN_FOR_STAFF, to: "CANCELLED" },
};

const REF = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const newReference = (kind: "VISA" | "FLIGHT") => {
  let out = "";
  for (let i = 0; i < 6; i++) out += REF[randomInt(REF.length)];
  return `${kind === "VISA" ? "PV" : "PF"}-${out}`;
};

const DETAIL_INCLUDE = {
  visaProduct: { select: { slug: true, country: true, visaType: true, requirements: true } },
  events: { orderBy: { id: "asc" } },
  documents: { orderBy: { id: "asc" } },
} satisfies Prisma.ServiceRequestInclude;
type DetailRow = Prisma.ServiceRequestGetPayload<{ include: typeof DETAIL_INCLUDE }>;

const strings = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

const notFound = () => new ProblemException(404, "request-not-found", "Request not found");
const wrongState = (status: string) =>
  new ProblemException(
    409,
    "request-state",
    "This request has moved on",
    `It is now ${status.toLowerCase().replaceAll("_", " ")}. Refresh the page.`,
  );

/**
 * Visa applications and flight requests (ADR-0039). Staff move a request
 * through its states; every change writes an event (the customer-visible
 * timeline), an audit entry for staff actions, and an outbox email, in the
 * same transaction. Documents are encrypted at rest and deleted
 * DOCUMENT_RETENTION_DAYS after the request closes.
 */
@Injectable()
export class ServiceRequestService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger("ServiceRequests");
  private readonly vault: DocumentVault | null;
  private timer: NodeJS.Timeout | undefined;

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(EmailVerificationService) private readonly verification: EmailVerificationService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    this.vault = config.DOCUMENT_ENCRYPTION_KEY
      ? new DocumentVault(config.DOCUMENT_ENCRYPTION_KEY)
      : null;
  }

  onModuleInit(): void {
    if (!this.config.RUN_BACKGROUND_JOBS) return;
    this.timer = setInterval(() => void this.purgeTick(), 60 * 60 * 1000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  get uploadsEnabled(): boolean {
    return this.vault !== null;
  }

  // ─── Customer ─────────────────────────────────────────────────────────────

  async createVisa(input: CreateVisaRequest, auth: AuthContext): Promise<ServiceRequestDetail> {
    await this.verification.assertVerified(auth.user.id);
    const product = await this.db.visaProduct.findFirst({
      where: { slug: input.visaProductSlug, status: "PUBLISHED" },
      select: { id: true },
    });
    if (!product) {
      throw new ProblemException(404, "visa-not-found", "This visa is not offered at the moment");
    }
    return this.create(auth, {
      kind: "VISA",
      visaProductId: product.id,
      travellers: input.travellers,
      details: input.details,
      contact: input.contact,
      note: input.note ?? null,
    });
  }

  async createFlight(input: CreateFlightRequest, auth: AuthContext): Promise<ServiceRequestDetail> {
    await this.verification.assertVerified(auth.user.id);
    const d = input.details;
    return this.create(auth, {
      kind: "FLIGHT",
      visaProductId: null,
      travellers: d.adults + d.children + d.infants,
      details: { ...d, returnDate: d.tripType === "ONE_WAY" ? null : d.returnDate },
      contact: input.contact,
      note: input.note ?? null,
    });
  }

  private async create(
    auth: AuthContext,
    r: {
      kind: "VISA" | "FLIGHT";
      visaProductId: bigint | null;
      travellers: number;
      details: VisaDetails | FlightDetails;
      contact: { name: string; email: string; phone: string };
      note: string | null;
    },
  ): Promise<ServiceRequestDetail> {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const publicId = await this.db.$transaction(async (tx) => {
          const row = await tx.serviceRequest.create({
            data: {
              publicId: newPublicId(),
              reference: newReference(r.kind),
              kind: r.kind,
              userId: auth.user.id,
              visaProductId: r.visaProductId,
              contactName: r.contact.name,
              contactEmail: r.contact.email,
              contactPhone: r.contact.phone,
              travellers: r.travellers,
              details: r.details as Prisma.InputJsonObject,
              note: r.note,
            },
          });
          await tx.serviceRequestEvent.create({
            data: {
              requestId: row.id,
              actorType: "CUSTOMER",
              actorUserId: auth.user.id,
              toStatus: "SUBMITTED",
              message: r.note,
            },
          });
          await this.outbox(tx, "service.created.customer", row.publicId, {});
          await this.outbox(tx, "service.created.staff", row.publicId, {});
          return row.publicId;
        });
        return this.mine(publicId, auth);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
          continue;
        throw error;
      }
    }
    throw new Error("Could not allocate a request reference");
  }

  async listMine(auth: AuthContext, cursor?: string) {
    const before = cursor && /^\d{1,20}$/.test(cursor) ? BigInt(cursor) : undefined;
    const rows = await this.db.serviceRequest.findMany({
      where: { userId: auth.user.id, ...(before ? { id: { lt: before } } : {}) },
      orderBy: { id: "desc" },
      take: 21,
      include: { visaProduct: { select: { country: true, visaType: true } } },
    });
    const page = rows.slice(0, 20);
    return {
      items: page.map((r) => this.summary(r)),
      nextCursor: rows.length > 20 ? page.at(-1)!.id.toString() : null,
    };
  }

  async mine(publicId: string, auth: AuthContext): Promise<ServiceRequestDetail> {
    const r = await this.db.serviceRequest.findFirst({
      where: { publicId, userId: auth.user.id },
      include: DETAIL_INCLUDE,
    });
    if (!r) throw notFound();
    return this.detail(r);
  }

  async reply(publicId: string, message: string, auth: AuthContext): Promise<ServiceRequestDetail> {
    await this.db.$transaction(async (tx) => {
      const r = await this.lockOwn(tx, publicId, auth);
      if (!CUSTOMER_REPLY.includes(r.status)) throw wrongState(r.status);
      const to = r.status === "NEEDS_INFO" ? "SUBMITTED" : null;
      if (to) await tx.serviceRequest.update({ where: { id: r.id }, data: { status: to } });
      await tx.serviceRequestEvent.create({
        data: {
          requestId: r.id,
          actorType: "CUSTOMER",
          actorUserId: auth.user.id,
          fromStatus: to ? r.status : null,
          toStatus: to,
          message,
        },
      });
      await this.outbox(tx, "service.reply.staff", publicId, { message: message.slice(0, 500) });
    });
    return this.mine(publicId, auth);
  }

  async cancelMine(publicId: string, reason: string | null, auth: AuthContext) {
    await this.db.$transaction(async (tx) => {
      const r = await this.lockOwn(tx, publicId, auth);
      if (!CUSTOMER_CANCELLABLE.includes(r.status)) throw wrongState(r.status);
      await tx.serviceRequest.update({
        where: { id: r.id },
        data: { status: "CANCELLED", closedAt: new Date() },
      });
      await tx.serviceRequestEvent.create({
        data: {
          requestId: r.id,
          actorType: "CUSTOMER",
          actorUserId: auth.user.id,
          fromStatus: r.status,
          toStatus: "CANCELLED",
          message: reason,
        },
      });
      await this.outbox(tx, "service.reply.staff", publicId, { cancelled: true });
    });
    return this.mine(publicId, auth);
  }

  private async lockOwn(tx: Tx, publicId: string, auth: AuthContext) {
    const rows = await tx.$queryRaw<Array<{ id: bigint }>>`
      SELECT id FROM service_requests WHERE public_id = ${publicId} AND user_id = ${auth.user.id} FOR UPDATE`;
    if (rows.length === 0) throw notFound();
    return tx.serviceRequest.findUniqueOrThrow({ where: { id: rows[0]!.id } });
  }

  // ─── Documents ────────────────────────────────────────────────────────────

  /** Stores one document (customer for their own request, or staff). */
  async upload(
    publicId: string,
    body: unknown,
    meta: { label: string; name: string },
    actor: { auth: AuthContext; staff: boolean; ip: string | null },
  ): Promise<void> {
    if (!this.vault) {
      throw new ProblemException(
        503,
        "uploads-off",
        "Document upload is not available yet",
        "Please send your documents to us by email or WhatsApp for now.",
      );
    }
    if (!Buffer.isBuffer(body) || body.length === 0) {
      throw new ProblemException(400, "empty-file", "Choose a file to upload");
    }
    if (body.length > DOCUMENT_MAX_BYTES) {
      throw new ProblemException(413, "file-too-large", "The file is larger than 5 MB");
    }
    const kind = sniffDocument(body);
    if (!kind) {
      throw new ProblemException(415, "file-type", "Upload a PDF, JPG or PNG file");
    }
    const docId = newPublicId();
    const sealed = this.vault.seal(body, docId);
    await this.db.$transaction(async (tx) => {
      const r = actor.staff
        ? await this.lockAny(tx, publicId)
        : await this.lockOwn(tx, publicId, actor.auth);
      if (!actor.staff && CLOSED.includes(r.status)) throw wrongState(r.status);
      if (r.documentsPurgedAt) throw wrongState(r.status);
      const count = await tx.serviceDocument.count({ where: { requestId: r.id } });
      if (count >= DOCUMENTS_PER_REQUEST) {
        throw new ProblemException(422, "too-many-files", "This request already has 20 documents");
      }
      const doc = await tx.serviceDocument.create({
        data: {
          publicId: docId,
          requestId: r.id,
          label: meta.label,
          fileName: safeFileName(meta.name, kind.ext),
          mime: kind.mime,
          byteSize: body.length,
          sha256: sealed.sha256,
          keyId: sealed.keyId,
          iv: new Uint8Array(sealed.iv),
          authTag: new Uint8Array(sealed.authTag),
          uploadedByStaff: actor.staff,
          uploadedById: actor.auth.user.id,
          blob: { create: { ciphertext: new Uint8Array(sealed.ciphertext) } },
        },
      });
      await tx.serviceRequestEvent.create({
        data: {
          requestId: r.id,
          actorType: actor.staff ? "STAFF" : "CUSTOMER",
          actorUserId: actor.auth.user.id,
          message: `Document added: ${meta.label}`,
        },
      });
      if (actor.staff) {
        await this.audit.record(
          {
            actorType: "STAFF",
            actorUserId: actor.auth.user.id,
            action: "service.document.uploaded",
            targetType: "service_request",
            targetId: publicId,
            ipAddress: actor.ip,
            metadata: { document: doc.publicId, label: meta.label },
          },
          tx,
        );
      } else {
        await this.outbox(tx, "service.reply.staff", publicId, { document: meta.label });
      }
    });
  }

  /** Decrypts a document for its owner or for staff (staff access is audited). */
  async download(
    requestPublicId: string,
    documentPublicId: string,
    actor: { auth: AuthContext; staff: boolean; ip: string | null },
  ): Promise<{ bytes: Buffer; mime: string; fileName: string }> {
    const doc = await this.db.serviceDocument.findFirst({
      where: {
        publicId: documentPublicId,
        request: {
          publicId: requestPublicId,
          ...(actor.staff ? {} : { userId: actor.auth.user.id }),
        },
      },
      include: { blob: true },
    });
    if (!doc?.blob) throw new ProblemException(404, "document-not-found", "Document not found");
    const bytes = this.vault?.open(doc, doc.blob.ciphertext, doc.publicId) ?? null;
    if (!bytes) {
      this.logger.error({ document: doc.publicId }, "Document could not be decrypted");
      throw new ProblemException(
        503,
        "document-locked",
        "This document cannot be opened",
        "The encryption key on the server has changed or is missing.",
      );
    }
    if (actor.staff) {
      await this.audit.record({
        actorType: "STAFF",
        actorUserId: actor.auth.user.id,
        action: "service.document.viewed",
        targetType: "service_request",
        targetId: requestPublicId,
        ipAddress: actor.ip,
        metadata: { document: doc.publicId, label: doc.label },
      });
    }
    return { bytes, mime: doc.mime, fileName: doc.fileName };
  }

  // ─── Console ──────────────────────────────────────────────────────────────

  async adminList(q: {
    kind?: "VISA" | "FLIGHT";
    status?: ServiceStatus;
    q?: string;
    cursor?: string;
    limit: number;
  }) {
    const before = q.cursor && /^\d{1,20}$/.test(q.cursor) ? BigInt(q.cursor) : undefined;
    const where: Prisma.ServiceRequestWhereInput = {
      ...(q.kind ? { kind: q.kind } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(before ? { id: { lt: before } } : {}),
      ...(q.q
        ? {
            OR: [
              { reference: { contains: q.q } },
              { contactName: { contains: q.q } },
              { contactPhone: { contains: q.q } },
              { contactEmail: { contains: q.q } },
            ],
          }
        : {}),
    };
    const rows = await this.db.serviceRequest.findMany({
      where,
      orderBy: { id: "desc" },
      take: q.limit + 1,
      include: { visaProduct: { select: { country: true, visaType: true } } },
    });
    const page = rows.slice(0, q.limit);
    return {
      items: page.map((r) => ({
        ...this.summary(r),
        customerName: r.contactName,
        contactPhone: r.contactPhone,
      })),
      nextCursor: rows.length > q.limit && page.length > 0 ? page.at(-1)!.id.toString() : null,
    };
  }

  async adminDetail(publicId: string) {
    const r = await this.db.serviceRequest.findUnique({
      where: { publicId },
      include: {
        ...DETAIL_INCLUDE,
        user: { select: { publicId: true, fullName: true, email: true } },
      },
    });
    if (!r) throw notFound();
    const staffIds = [
      ...new Set(r.events.map((e) => e.actorUserId).filter((x): x is bigint => !!x)),
    ];
    const names = new Map(
      (
        await this.db.user.findMany({
          where: { id: { in: staffIds } },
          select: { id: true, fullName: true },
        })
      ).map((u) => [u.id, u.fullName]),
    );
    return {
      ...this.detail(r),
      customer: { id: r.user.publicId, name: r.user.fullName, email: r.user.email },
      paidOffline: r.paidOffline,
      staffEvents: r.events.map((e) => ({
        at: e.createdAt.toISOString(),
        actor: e.actorType,
        actorName: e.actorUserId ? (names.get(e.actorUserId) ?? null) : null,
        fromStatus: (e.fromStatus as ServiceStatus | null) ?? null,
        toStatus: (e.toStatus as ServiceStatus | null) ?? null,
        message: e.message,
        internal: !e.visibleToCustomer,
      })),
    };
  }

  async act(publicId: string, input: ServiceAction, auth: AuthContext, ip: string | null) {
    await this.db.$transaction(async (tx) => {
      const r = await this.lockAny(tx, publicId);
      if (r.status !== input.expectedStatus) throw wrongState(r.status);
      const message = input.message ?? null;

      if (input.action === "NOTE") {
        await tx.serviceRequestEvent.create({
          data: {
            requestId: r.id,
            actorType: "STAFF",
            actorUserId: auth.user.id,
            message,
            visibleToCustomer: !input.internal,
          },
        });
        await this.record(tx, auth, ip, "service.note", publicId, { internal: !!input.internal });
        if (!input.internal) {
          await this.outbox(tx, "service.updated.customer", publicId, { action: "NOTE", message });
        }
        return;
      }

      const rule = ACTIONS[input.action];
      if (!rule.from.includes(r.status)) {
        throw new ProblemException(
          409,
          "action-not-allowed",
          "That step is not possible now",
          `A ${r.status.toLowerCase().replaceAll("_", " ")} request cannot do this.`,
        );
      }
      if (input.action === "START" && !r.paidAt) {
        throw new ProblemException(409, "not-paid", "Record the payment first");
      }
      const now = new Date();
      const data: Prisma.ServiceRequestUpdateInput = { status: rule.to };
      if (input.action === "QUOTE") {
        if (input.amount!.currency !== r.currency) {
          throw new ProblemException(422, "currency-mismatch", `Quote in ${r.currency}`);
        }
        data.quoteMinor = BigInt(input.amount!.amountMinor);
        data.quoteNote = message;
        data.quotedAt = now;
      }
      if (input.action === "MARK_PAID") {
        data.paidAt = now;
        data.paidOffline = input.paymentReference ?? null;
      }
      if (CLOSED.includes(rule.to)) data.closedAt = now;
      await tx.serviceRequest.update({ where: { id: r.id }, data });
      await tx.serviceRequestEvent.create({
        data: {
          requestId: r.id,
          actorType: "STAFF",
          actorUserId: auth.user.id,
          fromStatus: r.status,
          toStatus: rule.to,
          message:
            input.action === "MARK_PAID" ? (message ?? "Payment received. Thank you.") : message,
        },
      });
      await this.record(tx, auth, ip, `service.${input.action.toLowerCase()}`, publicId, {
        from: r.status,
        to: rule.to,
        ...(input.amount ? { amountMinor: input.amount.amountMinor } : {}),
        ...(input.paymentReference ? { paymentReference: input.paymentReference } : {}),
      });
      await this.outbox(tx, "service.updated.customer", publicId, {
        action: input.action,
        status: rule.to,
        message,
        wasPaid: !!r.paidAt,
      });
    });
    return this.adminDetail(publicId);
  }

  private async lockAny(tx: Tx, publicId: string) {
    const rows = await tx.$queryRaw<Array<{ id: bigint }>>`
      SELECT id FROM service_requests WHERE public_id = ${publicId} FOR UPDATE`;
    if (rows.length === 0) throw notFound();
    return tx.serviceRequest.findUniqueOrThrow({ where: { id: rows[0]!.id } });
  }

  // ─── Retention ────────────────────────────────────────────────────────────

  private async purgeTick() {
    try {
      const n = await this.purgeDocuments();
      if (n > 0) this.logger.log({ requests: n }, "Deleted documents of closed requests");
    } catch (error) {
      this.logger.warn({ err: error }, "Document retention sweep failed");
    }
  }

  /** Deletes documents of requests closed longer than the retention period. */
  async purgeDocuments(now: Date = new Date()): Promise<number> {
    const days = this.config.DOCUMENT_RETENTION_DAYS;
    const cutoff = new Date(now.getTime() - days * 86_400_000);
    const due = await this.db.serviceRequest.findMany({
      where: { closedAt: { lte: cutoff }, documentsPurgedAt: null },
      select: { id: true },
      take: 200,
    });
    for (const r of due) {
      await this.db.$transaction(async (tx) => {
        const deleted = await tx.serviceDocument.deleteMany({ where: { requestId: r.id } });
        await tx.serviceRequest.update({ where: { id: r.id }, data: { documentsPurgedAt: now } });
        if (deleted.count > 0) {
          await tx.serviceRequestEvent.create({
            data: {
              requestId: r.id,
              actorType: "SYSTEM",
              message: `Uploaded documents were deleted ${days} days after the request closed.`,
            },
          });
        }
      });
    }
    return due.length;
  }

  // ─── Mapping ──────────────────────────────────────────────────────────────

  private summary(r: {
    publicId: string;
    reference: string;
    kind: "VISA" | "FLIGHT";
    status: ServiceStatus;
    travellers: number;
    details: Prisma.JsonValue;
    quoteMinor: bigint | null;
    currency: string;
    createdAt: Date;
    updatedAt: Date;
    visaProduct: { country: string; visaType: string } | null;
  }) {
    return {
      id: r.publicId,
      reference: r.reference,
      kind: r.kind,
      status: r.status,
      title: titleOf(r),
      travellers: r.travellers,
      quote: r.quoteMinor !== null ? toMoney(r.quoteMinor, r.currency) : null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  private detail(r: DetailRow): ServiceRequestDetail {
    const d = (r.details ?? {}) as Record<string, unknown>;
    const closed = CLOSED.includes(r.status);
    return {
      ...this.summary(r),
      visa:
        r.kind === "VISA"
          ? {
              travelDate: String(d.travelDate),
              purpose: d.purpose as VisaDetails["purpose"],
              nationality: String(d.nationality ?? "BD"),
            }
          : null,
      flight:
        r.kind === "FLIGHT"
          ? {
              tripType: d.tripType as FlightDetails["tripType"],
              from: String(d.from),
              to: String(d.to),
              departDate: String(d.departDate),
              returnDate: d.returnDate ? String(d.returnDate) : null,
              adults: Number(d.adults),
              children: Number(d.children),
              infants: Number(d.infants),
              cabin: d.cabin as FlightDetails["cabin"],
              preferredAirline: d.preferredAirline ? String(d.preferredAirline) : null,
            }
          : null,
      visaProduct: r.visaProduct
        ? {
            slug: r.visaProduct.slug,
            country: r.visaProduct.country,
            visaType: r.visaProduct.visaType,
            requirements: strings(r.visaProduct.requirements),
          }
        : null,
      contactName: r.contactName,
      contactEmail: r.contactEmail,
      contactPhone: r.contactPhone,
      note: r.note,
      quoteNote: r.quoteNote,
      quotedAt: r.quotedAt?.toISOString() ?? null,
      paidAt: r.paidAt?.toISOString() ?? null,
      events: r.events
        .filter((e) => e.visibleToCustomer)
        .map((e) => ({
          at: e.createdAt.toISOString(),
          actor: e.actorType,
          toStatus: (e.toStatus as ServiceStatus | null) ?? null,
          message: e.message,
        })),
      documents: r.documents.map((x) => ({
        id: x.publicId,
        label: x.label,
        fileName: x.fileName,
        mime: x.mime,
        byteSize: x.byteSize,
        uploadedByStaff: x.uploadedByStaff,
        createdAt: x.createdAt.toISOString(),
      })),
      documentsPurged: r.documentsPurgedAt !== null,
      uploadsEnabled: this.uploadsEnabled,
      canCancel: CUSTOMER_CANCELLABLE.includes(r.status),
      canReply: CUSTOMER_REPLY.includes(r.status),
      canUpload: this.uploadsEnabled && !closed && r.documentsPurgedAt === null,
    };
  }

  private outbox(tx: Tx, eventType: string, publicId: string, payload: Prisma.InputJsonObject) {
    return tx.outboxEvent.create({
      data: { eventType, aggregateType: "service_request", aggregateId: publicId, payload },
    });
  }

  private record(
    tx: Tx,
    auth: AuthContext,
    ip: string | null,
    action: string,
    targetId: string,
    metadata: Prisma.InputJsonObject,
  ) {
    return this.audit.record(
      {
        actorType: "STAFF",
        actorUserId: auth.user.id,
        action,
        targetType: "service_request",
        targetId,
        ipAddress: ip,
        metadata,
      },
      tx,
    );
  }
}

const CABIN: Record<string, string> = {
  ECONOMY: "Economy",
  PREMIUM_ECONOMY: "Premium economy",
  BUSINESS: "Business",
  FIRST: "First",
};

/** One-line description used in lists and emails. */
export function titleOf(r: {
  kind: "VISA" | "FLIGHT";
  details: Prisma.JsonValue;
  visaProduct: { country: string; visaType: string } | null;
}): string {
  if (r.kind === "VISA") {
    return r.visaProduct ? `${r.visaProduct.country} · ${r.visaProduct.visaType}` : "Visa";
  }
  const d = (r.details ?? {}) as Record<string, unknown>;
  const trip = d.tripType === "ROUND_TRIP" ? "Round trip" : "One way";
  return `${String(d.from)} → ${String(d.to)} · ${trip} · ${CABIN[String(d.cabin)] ?? ""}`.replace(
    / · $/,
    "",
  );
}
