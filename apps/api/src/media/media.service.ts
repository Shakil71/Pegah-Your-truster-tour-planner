import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@pegah/db";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import type {
  MediaAssetViewSchema,
  MediaListQuerySchema,
  MediaUpdateSchema,
  MediaUploadQuerySchema,
} from "@pegah/contracts";
import { AuditService } from "../audit/audit.service";
import type { AuthContext } from "../auth/auth.types";
import { decodeCursor, encodeCursor } from "../booking/booking.mappers";
import { ProblemException } from "../common/problem";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { PRISMA, type Db } from "../prisma/prisma.service";

type View = z.infer<typeof MediaAssetViewSchema>;
type Upload = z.infer<typeof MediaUploadQuerySchema>;

/** Largest accepted upload; Nginx also caps request bodies at 1 MB. The console resizes first. */
export const MEDIA_MAX_BYTES = 1_000_000;
const MAX_EDGE = 2000;
const INPUT_FORMATS = new Set(["jpeg", "png", "webp"]);

const INCLUDE = {
  _count: { select: { hotels: true, tours: true, destinations: true } },
} satisfies Prisma.MediaAssetInclude;
type Row = Prisma.MediaAssetGetPayload<{ include: typeof INCLUDE }>;

/**
 * Media library (ADR-0030). Every upload is decoded, auto-rotated, stripped of
 * metadata (camera, GPS), limited to 2000 px and re-encoded as WebP, so only
 * clean images are stored and served. Images live in MySQL (media_blobs); the
 * key is a content hash, so URLs can be cached forever and duplicates collapse.
 */
@Injectable()
export class MediaService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private view(m: Row): View {
    const base = this.config.MEDIA_BASE_URL.replace(/\/$/, "");
    return {
      key: m.storageKey,
      url: `${base}/${m.storageKey}`,
      alt: m.altText,
      credit: m.credit,
      license: m.license,
      width: m.width,
      height: m.height,
      byteSize: m.byteSize,
      createdAt: m.createdAt.toISOString(),
      usedBy: {
        hotels: m._count.hotels,
        tours: m._count.tours,
        destinations: m._count.destinations,
      },
    };
  }

  async list(q: z.infer<typeof MediaListQuerySchema>) {
    const where: Prisma.MediaAssetWhereInput = { blob: { isNot: null } };
    if (q.q) where.OR = [{ altText: { contains: q.q } }, { credit: { contains: q.q } }];
    const before = decodeCursor(q.cursor);
    if (before !== undefined) where.id = { lt: before };
    const rows = await this.db.mediaAsset.findMany({
      where,
      orderBy: { id: "desc" },
      take: q.limit + 1,
      include: INCLUDE,
    });
    const page = rows.slice(0, q.limit);
    return {
      items: page.map((m) => this.view(m)),
      nextCursor:
        rows.length > q.limit && page.length > 0 ? encodeCursor(page[page.length - 1]!.id) : null,
    };
  }

  async upload(
    body: unknown,
    meta: Upload,
    actor: AuthContext,
    ip: string | null,
  ): Promise<{ created: boolean; media: View }> {
    if (!Buffer.isBuffer(body) || body.length === 0) {
      throw new ProblemException(400, "image-required", "Send the image file as the request body");
    }
    if (body.length > MEDIA_MAX_BYTES) {
      throw new ProblemException(413, "image-too-large", "Images must be 1 MB or smaller");
    }
    let output: { data: Buffer; info: sharp.OutputInfo };
    try {
      const input = sharp(body, { failOn: "error", limitInputPixels: 50_000_000 });
      const { format } = await input.metadata();
      if (!format || !INPUT_FORMATS.has(format)) throw new Error("unsupported");
      output = await input
        .rotate()
        .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true });
    } catch {
      throw new ProblemException(422, "image-unreadable", "Use a JPEG, PNG or WebP image");
    }
    const key = `${createHash("sha256").update(output.data).digest("hex").slice(0, 24)}.webp`;
    const existing = await this.db.mediaAsset.findUnique({
      where: { storageKey: key },
      include: INCLUDE,
    });
    if (existing) return { created: false, media: this.view(existing) };

    const row = await this.db.$transaction(async (tx) => {
      const asset = await tx.mediaAsset.create({
        data: {
          storageKey: key,
          altText: meta.alt,
          credit: meta.credit || null,
          license: meta.license || null,
          width: output.info.width,
          height: output.info.height,
          byteSize: output.data.length,
          uploadedBy: actor.user.id,
          blob: { create: { mime: "image/webp", bytes: new Uint8Array(output.data) } },
        },
        include: INCLUDE,
      });
      await this.audit.record(
        {
          actorType: "STAFF",
          actorUserId: actor.user.id,
          action: "media.uploaded",
          targetType: "media",
          targetId: key,
          ipAddress: ip,
          metadata: {
            bytes: output.data.length,
            width: output.info.width,
            height: output.info.height,
          },
        },
        tx,
      );
      return asset;
    });
    return { created: true, media: this.view(row) };
  }

  async update(
    key: string,
    input: z.infer<typeof MediaUpdateSchema>,
    actor: AuthContext,
    ip: string | null,
  ) {
    const row = await this.db.$transaction(async (tx) => {
      const found = await tx.mediaAsset.findUnique({ where: { storageKey: key } });
      if (!found) throw new ProblemException(404, "media-not-found", "Image not found");
      const updated = await tx.mediaAsset.update({
        where: { id: found.id },
        data: { altText: input.alt, credit: input.credit, license: input.license },
        include: INCLUDE,
      });
      await this.audit.record(
        {
          actorType: "STAFF",
          actorUserId: actor.user.id,
          action: "media.updated",
          targetType: "media",
          targetId: key,
          ipAddress: ip,
        },
        tx,
      );
      return updated;
    });
    return { media: this.view(row) };
  }

  /** Deletes an image that nothing uses; in-use images must be replaced first. */
  async remove(key: string, actor: AuthContext, ip: string | null): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const found = await tx.mediaAsset.findUnique({
        where: { storageKey: key },
        include: INCLUDE,
      });
      if (!found) throw new ProblemException(404, "media-not-found", "Image not found");
      const uses = found._count.hotels + found._count.tours + found._count.destinations;
      if (uses > 0) {
        throw new ProblemException(
          409,
          "media-in-use",
          "This image is in use",
          `Used as the main photo ${uses} time(s). Choose another photo there first.`,
        );
      }
      await tx.mediaAsset.delete({ where: { id: found.id } });
      await this.audit.record(
        {
          actorType: "STAFF",
          actorUserId: actor.user.id,
          action: "media.deleted",
          targetType: "media",
          targetId: key,
          ipAddress: ip,
        },
        tx,
      );
    });
  }

  /** The stored image bytes for the public /media route. */
  async file(key: string): Promise<{ mime: string; bytes: Buffer } | null> {
    const row = await this.db.mediaBlob.findFirst({
      where: { asset: { storageKey: key } },
      select: { mime: true, bytes: true },
    });
    return row ? { mime: row.mime, bytes: Buffer.from(row.bytes) } : null;
  }
}
