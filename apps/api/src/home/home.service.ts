import { Inject, Injectable } from "@nestjs/common";
import { HomeSettingsSchema, type HomeSettings, type PublicHome } from "@pegah/contracts";
import { AuditService } from "../audit/audit.service";
import type { AuthContext } from "../auth/auth.types";
import { CatalogService } from "../catalog/catalog.service";
import { ProblemException } from "../common/problem";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { PRISMA, type Db } from "../prisma/prisma.service";

const KEY = "home";
const EMPTY: HomeSettings = {
  slides: [],
  featuredDestinations: [],
  featuredHotels: [],
  featuredTours: [],
  promises: [],
};

/**
 * Home page content (ADR-0031): stored in site_settings["home"], resolved
 * against the published catalog when the website asks for it, so unpublished
 * or deleted items simply drop out instead of breaking the page.
 */
@Injectable()
export class HomeService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(CatalogService) private readonly catalog: CatalogService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async settings(): Promise<HomeSettings> {
    const row = await this.db.siteSetting.findUnique({ where: { key: KEY } });
    return HomeSettingsSchema.safeParse(row?.value).data ?? EMPTY;
  }

  async save(input: HomeSettings, actor: AuthContext, ip: string | null): Promise<HomeSettings> {
    const keys = [...new Set(input.slides.map((s) => s.media))];
    if (keys.length > 0) {
      const found = await this.db.mediaAsset.count({ where: { storageKey: { in: keys } } });
      if (found !== keys.length) {
        throw new ProblemException(
          422,
          "unknown-media",
          "A slide uses an image that is not in the library",
        );
      }
    }
    await this.db.$transaction(async (tx) => {
      await tx.siteSetting.upsert({
        where: { key: KEY },
        create: { key: KEY, value: input, updatedBy: actor.user.id },
        update: { value: input, updatedBy: actor.user.id },
      });
      await this.audit.record(
        {
          actorType: "STAFF",
          actorUserId: actor.user.id,
          action: "content.home_updated",
          targetType: "settings",
          targetId: KEY,
          ipAddress: ip,
          metadata: {
            slides: input.slides.length,
            destinations: input.featuredDestinations.length,
            hotels: input.featuredHotels.length,
            tours: input.featuredTours.length,
            promises: input.promises.length,
          },
        },
        tx,
      );
    });
    return this.settings();
  }

  async publicHome(): Promise<PublicHome> {
    const s = await this.settings();
    const base = this.config.MEDIA_BASE_URL.replace(/\/$/, "");
    const [media, destinations, hotels, tours] = await Promise.all([
      s.slides.length
        ? this.db.mediaAsset.findMany({
            where: { storageKey: { in: s.slides.map((x) => x.media) } },
            select: { storageKey: true, altText: true, credit: true },
          })
        : Promise.resolve([]),
      s.featuredDestinations.length ? this.catalog.listDestinations() : Promise.resolve([]),
      this.catalog.hotelsBySlug(s.featuredHotels),
      s.featuredTours.length ? this.catalog.listTours() : Promise.resolve([]),
    ]);
    const mediaByKey = new Map(media.map((m) => [m.storageKey, m]));
    const pick = <T extends { slug: string }>(all: T[], slugs: string[]) => {
      const bySlug = new Map(all.map((x) => [x.slug, x]));
      return slugs.flatMap((slug) => bySlug.get(slug) ?? []);
    };
    return {
      slides: s.slides.flatMap((slide) => {
        const m = mediaByKey.get(slide.media);
        return m
          ? [
              {
                url: `${base}/${m.storageKey}`,
                alt: m.altText,
                credit: m.credit,
                placeEn: slide.placeEn,
                placeBn: slide.placeBn,
              },
            ]
          : [];
      }),
      destinations: pick(destinations, s.featuredDestinations),
      hotels,
      tours: pick(tours, s.featuredTours),
      promises: s.promises,
    };
  }
}
