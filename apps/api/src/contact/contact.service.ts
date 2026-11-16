import { Inject, Injectable } from "@nestjs/common";
import type { AdminContactMessage, ContactMessageCreate, ContactStatus } from "@pegah/contracts";
import { Prisma } from "@pegah/db";
import { AuditService } from "../audit/audit.service";
import type { AuthContext } from "../auth/auth.types";
import { newContactReference, newPublicId } from "../common/ids";
import { ProblemException } from "../common/problem";
import { PRISMA, type Db } from "../prisma/prisma.service";

const CONTACT_INCLUDE = {
  user: { select: { id: true } },
} satisfies Prisma.ContactMessageInclude;
type Row = Prisma.ContactMessageGetPayload<{ include: typeof CONTACT_INCLUDE }>;

/**
 * Contact form messages (ADR-0041). Anyone may send one; a signed-in
 * customer's message is linked to their account. Staff with service:manage
 * read them and track their status. Messages hold or confirm nothing.
 */
@Injectable()
export class ContactService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async create(
    input: ContactMessageCreate,
    customer: AuthContext | undefined,
    ip: string | null,
  ): Promise<{ reference: string }> {
    // A filled honeypot means a bot; answer as if it worked and store nothing.
    if (input.website) return { reference: newContactReference() };

    for (let attempt = 0; attempt < 3; attempt++) {
      const reference = newContactReference();
      try {
        await this.db.$transaction(async (tx) => {
          const row = await tx.contactMessage.create({
            data: {
              publicId: newPublicId(),
              reference,
              topic: input.topic,
              name: input.name,
              email: input.email,
              phone: input.phone,
              travelDate: input.travelDate ? new Date(`${input.travelDate}T00:00:00Z`) : null,
              guests: input.guests ?? null,
              message: input.message,
              userId: customer?.kind === "CUSTOMER" ? customer.user.id : null,
            },
          });
          const payload = { locale: input.locale ?? "en" };
          await tx.outboxEvent.createMany({
            data: [
              {
                eventType: "contact.created.customer",
                aggregateType: "contact_message",
                aggregateId: row.publicId,
                payload,
              },
              {
                eventType: "contact.created.staff",
                aggregateType: "contact_message",
                aggregateId: row.publicId,
                payload,
              },
            ],
          });
          await this.audit.record(
            {
              actorType: customer?.kind === "CUSTOMER" ? "CUSTOMER" : "SYSTEM",
              actorUserId: customer?.kind === "CUSTOMER" ? customer.user.id : null,
              action: "contact.created",
              targetType: "contact_message",
              targetId: row.publicId,
              ipAddress: ip,
              metadata: { reference, topic: input.topic },
            },
            tx,
          );
        });
        return { reference };
      } catch (error) {
        // Reference collision (unique index): try another.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          continue;
        }
        throw error;
      }
    }
    throw new ProblemException(503, "contact-busy", "Please try again in a moment");
  }

  async adminList(q: { status?: ContactStatus; q?: string; cursor?: string; limit: number }) {
    const before = q.cursor && /^\d{1,20}$/.test(q.cursor) ? BigInt(q.cursor) : undefined;
    const where: Prisma.ContactMessageWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(before ? { id: { lt: before } } : {}),
      ...(q.q
        ? {
            OR: [
              { reference: { contains: q.q } },
              { name: { contains: q.q } },
              { phone: { contains: q.q } },
              { email: { contains: q.q } },
            ],
          }
        : {}),
    };
    const [rows, grouped] = await Promise.all([
      this.db.contactMessage.findMany({
        where,
        orderBy: { id: "desc" },
        take: q.limit + 1,
        include: CONTACT_INCLUDE,
      }),
      this.db.contactMessage.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);
    const page = rows.slice(0, q.limit);
    const handlers = await this.handlerNames(page);
    const count = (s: ContactStatus) => grouped.find((g) => g.status === s)?._count._all ?? 0;
    return {
      items: page.map((r) => this.view(r, handlers)),
      counts: { NEW: count("NEW"), IN_PROGRESS: count("IN_PROGRESS"), CLOSED: count("CLOSED") },
      nextCursor: rows.length > q.limit && page.length > 0 ? page.at(-1)!.id.toString() : null,
    };
  }

  async update(
    publicId: string,
    input: { status: ContactStatus; staffNote?: string },
    actor: AuthContext,
    ip: string | null,
  ): Promise<AdminContactMessage> {
    const row = await this.db.$transaction(async (tx) => {
      const existing = await tx.contactMessage.findUnique({ where: { publicId } });
      if (!existing) throw new ProblemException(404, "contact-not-found", "Message not found");
      const updated = await tx.contactMessage.update({
        where: { id: existing.id },
        data: {
          status: input.status,
          ...(input.staffNote !== undefined ? { staffNote: input.staffNote || null } : {}),
          handledById: actor.user.id,
          handledAt: new Date(),
        },
        include: CONTACT_INCLUDE,
      });
      await this.audit.record(
        {
          actorType: "STAFF",
          actorUserId: actor.user.id,
          action: "contact.updated",
          targetType: "contact_message",
          targetId: publicId,
          ipAddress: ip,
          metadata: {
            from: existing.status,
            to: input.status,
            note: input.staffNote !== undefined,
          },
        },
        tx,
      );
      return updated;
    });
    return this.view(row, await this.handlerNames([row]));
  }

  private async handlerNames(rows: Row[]): Promise<Map<bigint, string>> {
    const ids = [...new Set(rows.map((r) => r.handledById).filter((x): x is bigint => x !== null))];
    if (ids.length === 0) return new Map();
    const users = await this.db.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, fullName: true },
    });
    return new Map(users.map((u) => [u.id, u.fullName]));
  }

  private view(r: Row, handlers: Map<bigint, string>): AdminContactMessage {
    return {
      id: r.publicId,
      reference: r.reference,
      topic: r.topic,
      status: r.status,
      name: r.name,
      email: r.email,
      phone: r.phone,
      travelDate: r.travelDate ? r.travelDate.toISOString().slice(0, 10) : null,
      guests: r.guests,
      message: r.message,
      signedIn: r.user !== null,
      staffNote: r.staffNote,
      handledBy: r.handledById ? (handlers.get(r.handledById) ?? null) : null,
      handledAt: r.handledAt ? r.handledAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
