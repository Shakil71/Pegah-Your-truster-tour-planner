import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { ApiBody, ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import {
  AdInputSchema,
  AdListQuerySchema,
  AdminAdListSchema,
  AdminAdResultSchema,
  AdminGiftCardListQuerySchema,
  AdminGiftCardListSchema,
  AdminGiftCardResultSchema,
  AdminOfferListSchema,
  AdminOfferResultSchema,
  AdminOrderListQuerySchema,
  AdminOrderListSchema,
  AdminOrderSchema,
  CancelOrderSchema,
  CreateGiftCardOrderSchema,
  CreateOfferOrderSchema,
  CreateOfferSchema,
  GiftCardBalanceQuerySchema,
  GiftCardBalanceSchema,
  IssueGiftCardSchema,
  MarkOrderPaidSchema,
  OfferInputSchema,
  OrderListSchema,
  OrderViewSchema,
  PaginationQuerySchema,
  PaymentSessionResponseSchema,
  PublicAdListSchema,
  PublicIdSchema,
  PublicOfferListSchema,
  PublicOfferSchema,
  SlugSchema,
  VoidGiftCardSchema,
  type CreateGiftCardOrderSchema as GiftOrder,
  type CreateOfferSchema as CreateOffer,
} from "@pegah/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import { createZodDto, ZodResponse, ZodValidationPipe } from "nestjs-zod";
import { z } from "zod";
import type { AuthContext } from "../auth/auth.types";
import { CurrentAuth, Public, RequirePermissions } from "../auth/decorators";
import { ProblemException } from "../common/problem";
import { PaymentService } from "../payments/payment.service";
import { GiftCardService } from "./gift-card.service";
import { OffersService } from "./offers.service";
import { OrderService } from "./order.service";

class PublicOfferListDto extends createZodDto(PublicOfferListSchema) {}
class PublicOfferDto extends createZodDto(PublicOfferSchema) {}
class PublicAdListDto extends createZodDto(PublicAdListSchema) {}
class AdListQueryDto extends createZodDto(AdListQuerySchema) {}
class GiftCardBalanceQueryDto extends createZodDto(GiftCardBalanceQuerySchema) {}
class GiftCardBalanceDto extends createZodDto(GiftCardBalanceSchema) {}
class GiftCardAvailabilityDto extends createZodDto(
  z.object({ available: z.boolean(), minTaka: z.number().int(), maxTaka: z.number().int() }),
) {}
class MyOrderListQueryDto extends createZodDto(PaginationQuerySchema) {}
class MyOrderListDto extends createZodDto(OrderListSchema) {}
class MyOrderDto extends createZodDto(OrderViewSchema) {}
class CreateOfferOrderDto extends createZodDto(CreateOfferOrderSchema) {}
class CreateGiftCardOrderDto extends createZodDto(CreateGiftCardOrderSchema) {}
class OrderPaymentSessionDto extends createZodDto(PaymentSessionResponseSchema) {}
class AdminOfferListDto extends createZodDto(AdminOfferListSchema) {}
class AdminOfferResultDto extends createZodDto(AdminOfferResultSchema) {}
class AdminOfferInputDto extends createZodDto(OfferInputSchema) {}
class AdminCreateOfferDto extends createZodDto(CreateOfferSchema) {}
class AdminAdListDto extends createZodDto(AdminAdListSchema) {}
class AdminAdResultDto extends createZodDto(AdminAdResultSchema) {}
class AdminAdInputDto extends createZodDto(AdInputSchema) {}
class AdminOrderListQueryDto extends createZodDto(AdminOrderListQuerySchema) {}
class AdminOrderListDto extends createZodDto(AdminOrderListSchema) {}
class AdminOrderDto extends createZodDto(AdminOrderSchema) {}
class AdminMarkPaidDto extends createZodDto(MarkOrderPaidSchema) {}
class AdminCancelOrderDto extends createZodDto(CancelOrderSchema) {}
class AdminGiftCardListQueryDto extends createZodDto(AdminGiftCardListQuerySchema) {}
class AdminGiftCardListDto extends createZodDto(AdminGiftCardListSchema) {}
class AdminGiftCardResultDto extends createZodDto(AdminGiftCardResultSchema) {}
class AdminIssueGiftCardDto extends createZodDto(IssueGiftCardSchema) {}
class AdminVoidGiftCardDto extends createZodDto(VoidGiftCardSchema) {}

const ip = (r: FastifyRequest) => r.ip ?? null;
const noStore = (reply: FastifyReply) => void reply.header("cache-control", "no-store");
const pid = (id: string, what: string) => {
  const p = PublicIdSchema.safeParse(id);
  if (!p.success) throw new ProblemException(404, `${what}-not-found`, "Not found");
  return p.data;
};

// ─── Website ─────────────────────────────────────────────────────────────────

@ApiTags("offers")
@Public()
@Controller()
export class PublicCommerceController {
  constructor(
    @Inject(OffersService) private readonly offers: OffersService,
    @Inject(GiftCardService) private readonly giftCards: GiftCardService,
  ) {}

  @Get("offers")
  @ZodResponse({ status: 200, type: PublicOfferListDto })
  list(@Res({ passthrough: true }) reply: FastifyReply) {
    void reply.header("cache-control", "public, max-age=60, stale-while-revalidate=120");
    return this.offers.publicOffers();
  }

  @Get("offers/:slug")
  @ZodResponse({ status: 200, type: PublicOfferDto })
  one(@Param("slug") slug: string, @Res({ passthrough: true }) reply: FastifyReply) {
    const s = SlugSchema.safeParse(slug);
    if (!s.success) throw new ProblemException(404, "offer-not-found", "Offer not found");
    void reply.header("cache-control", "public, max-age=30, stale-while-revalidate=60");
    return this.offers.publicOffer(s.data);
  }

  @Get("ads")
  @ZodResponse({ status: 200, type: PublicAdListDto })
  ads(@Query() q: AdListQueryDto, @Res({ passthrough: true }) reply: FastifyReply) {
    void reply.header("cache-control", "public, max-age=60, stale-while-revalidate=120");
    return this.offers.liveAds(q.placement);
  }

  @Get("gift-cards/availability")
  @ZodResponse({ status: 200, type: GiftCardAvailabilityDto })
  availability() {
    return { available: this.giftCards.available, minTaka: 500, maxTaka: 100_000 };
  }

  /** Balance by code. Rate limited: codes have 80 random bits, and lookups are slowed further. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get("gift-cards/balance")
  @ZodResponse({ status: 200, type: GiftCardBalanceDto })
  balance(@Query() q: GiftCardBalanceQueryDto, @Res({ passthrough: true }) reply: FastifyReply) {
    noStore(reply);
    return this.giftCards.balance(q.code);
  }
}

@ApiTags("orders")
@ApiCookieAuth("customer")
@Controller("me/orders")
export class MyOrdersController {
  constructor(
    @Inject(OrderService) private readonly orders: OrderService,
    @Inject(PaymentService) private readonly payments: PaymentService,
  ) {}

  @Get()
  @ZodResponse({ status: 200, type: MyOrderListDto })
  list(
    @CurrentAuth() a: AuthContext,
    @Query() q: MyOrderListQueryDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    noStore(reply);
    return this.orders.listMine(a, q.cursor);
  }

  @Get(":id")
  @ZodResponse({ status: 200, type: MyOrderDto })
  one(
    @CurrentAuth() a: AuthContext,
    @Param("id") id: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    noStore(reply);
    return this.orders.mine(pid(id, "order"), a);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("offer")
  @ZodResponse({ status: 201, type: MyOrderDto })
  offer(@CurrentAuth() a: AuthContext, @Body() body: CreateOfferOrderDto) {
    return this.orders.createOfferOrder(body, a);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("gift-card")
  @ApiBody({ type: CreateGiftCardOrderDto })
  @ZodResponse({ status: 201, type: MyOrderDto })
  giftCard(
    @CurrentAuth() a: AuthContext,
    @Body(new ZodValidationPipe(CreateGiftCardOrderSchema)) body: z.infer<typeof GiftOrder>,
  ) {
    return this.orders.createGiftCardOrder(body, a);
  }

  @Post(":id/payment-session")
  @HttpCode(201)
  @ZodResponse({ status: 201, type: OrderPaymentSessionDto })
  pay(@CurrentAuth() a: AuthContext, @Param("id") id: string, @Req() r: FastifyRequest) {
    return this.payments.startOrderSession(pid(id, "order"), a.user, ip(r));
  }
}

// ─── Console ─────────────────────────────────────────────────────────────────

@ApiTags("admin-commerce")
@ApiCookieAuth("staff")
@Controller("admin")
export class AdminCommerceController {
  constructor(
    @Inject(OffersService) private readonly offers: OffersService,
    @Inject(OrderService) private readonly orders: OrderService,
    @Inject(GiftCardService) private readonly giftCards: GiftCardService,
  ) {}

  // Offers
  @RequirePermissions("promotion:manage")
  @Get("offers")
  @ZodResponse({ status: 200, type: AdminOfferListDto })
  offerList(@Res({ passthrough: true }) reply: FastifyReply) {
    noStore(reply);
    return this.offers.adminOffers();
  }

  @RequirePermissions("promotion:manage")
  @Post("offers")
  @ApiBody({ type: AdminCreateOfferDto })
  @ZodResponse({ status: 201, type: AdminOfferResultDto })
  createOffer(
    @Body(new ZodValidationPipe(CreateOfferSchema)) body: z.infer<typeof CreateOffer>,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    return this.offers.createOffer(body, a, ip(r));
  }

  @RequirePermissions("promotion:manage")
  @Put("offers/:id")
  @ZodResponse({ status: 200, type: AdminOfferResultDto })
  updateOffer(
    @Param("id") id: string,
    @Body() body: AdminOfferInputDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    return this.offers.updateOffer(pid(id, "offer"), body, a, ip(r));
  }

  // Ads
  @RequirePermissions("promotion:manage")
  @Get("ads")
  @ZodResponse({ status: 200, type: AdminAdListDto })
  adList(@Res({ passthrough: true }) reply: FastifyReply) {
    noStore(reply);
    return this.offers.adminAds();
  }

  @RequirePermissions("promotion:manage")
  @Post("ads")
  @ZodResponse({ status: 201, type: AdminAdResultDto })
  createAd(@Body() body: AdminAdInputDto, @CurrentAuth() a: AuthContext, @Req() r: FastifyRequest) {
    return this.offers.createAd(body, a, ip(r));
  }

  @RequirePermissions("promotion:manage")
  @Put("ads/:id")
  @ZodResponse({ status: 200, type: AdminAdResultDto })
  updateAd(
    @Param("id") id: string,
    @Body() body: AdminAdInputDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    return this.offers.updateAd(pid(id, "ad"), body, a, ip(r));
  }

  @RequirePermissions("promotion:manage")
  @Delete("ads/:id")
  @HttpCode(204)
  async deleteAd(@Param("id") id: string, @CurrentAuth() a: AuthContext, @Req() r: FastifyRequest) {
    await this.offers.deleteAd(pid(id, "ad"), a, ip(r));
  }

  // Orders
  @RequirePermissions("payment:read")
  @Get("orders")
  @ZodResponse({ status: 200, type: AdminOrderListDto })
  orderList(@Query() q: AdminOrderListQueryDto, @Res({ passthrough: true }) reply: FastifyReply) {
    noStore(reply);
    return this.orders.adminList(q);
  }

  @RequirePermissions("payment:read")
  @Get("orders/:id")
  @ZodResponse({ status: 200, type: AdminOrderDto })
  order(@Param("id") id: string, @Res({ passthrough: true }) reply: FastifyReply) {
    noStore(reply);
    return this.orders.adminDetail(pid(id, "order"));
  }

  @RequirePermissions("order:manage")
  @Post("orders/:id/mark-paid")
  @HttpCode(200)
  @ZodResponse({ status: 200, type: AdminOrderDto })
  markPaid(
    @Param("id") id: string,
    @Body() body: AdminMarkPaidDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    return this.orders.markPaid(pid(id, "order"), body.reference, a, ip(r));
  }

  @RequirePermissions("order:manage")
  @Post("orders/:id/cancel")
  @HttpCode(200)
  @ZodResponse({ status: 200, type: AdminOrderDto })
  cancelOrder(
    @Param("id") id: string,
    @Body() body: AdminCancelOrderDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    return this.orders.cancel(pid(id, "order"), body.reason, a, ip(r));
  }

  // Gift cards
  @RequirePermissions("payment:read")
  @Get("gift-cards")
  @ZodResponse({ status: 200, type: AdminGiftCardListDto })
  giftCardList(
    @Query() q: AdminGiftCardListQueryDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    noStore(reply);
    return this.giftCards.list(q);
  }

  @RequirePermissions("order:manage")
  @Post("gift-cards")
  @ZodResponse({ status: 201, type: AdminGiftCardResultDto })
  async issue(
    @Body() body: AdminIssueGiftCardDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    return { giftCard: await this.giftCards.issueManually(body, a, ip(r)) };
  }

  @RequirePermissions("order:manage")
  @Post("gift-cards/:id/void")
  @HttpCode(200)
  @ZodResponse({ status: 200, type: AdminGiftCardResultDto })
  async voidCard(
    @Param("id") id: string,
    @Body() body: AdminVoidGiftCardDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    return { giftCard: await this.giftCards.void(pid(id, "gift-card"), body.reason, a, ip(r)) };
  }

  @RequirePermissions("order:manage")
  @Post("gift-cards/:id/resend")
  @HttpCode(204)
  async resend(@Param("id") id: string, @CurrentAuth() a: AuthContext, @Req() r: FastifyRequest) {
    await this.giftCards.resend(pid(id, "gift-card"), a, ip(r));
  }
}
