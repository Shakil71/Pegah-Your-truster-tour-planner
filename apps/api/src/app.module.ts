import { AdminSettingsController } from "./admin/settings.controller";
import { DynamicModule, Global, Module, type Provider } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { ZodSerializerInterceptor, ZodValidationPipe } from "nestjs-zod";
import {
  AccountController,
  AdminRefundsController,
  PasswordResetController,
} from "./account/account.controllers";
import { AccountService } from "./account/account.service";
import { CancellationService } from "./account/cancellation.service";
import { AdminController } from "./admin/admin.controllers";
import { AuditQueryService } from "./admin/audit-query.service";
import { DashboardService } from "./admin/dashboard.service";
import { StaffService } from "./admin/staff.service";
import { AuditService } from "./audit/audit.service";
import { AuthController, PartnerAuthController, StaffAuthController } from "./auth/auth.controller";
import { AuthGuard } from "./auth/auth.guard";
import { AuthService } from "./auth/auth.service";
import { PasswordService } from "./auth/password.service";
import { SessionService } from "./auth/session.service";
import { BookingCreateService } from "./booking/booking-create.service";
import { BookingQueryService } from "./booking/booking-query.service";
import { BookingStatusService } from "./booking/booking-status.service";
import {
  AdminBookingsController,
  BookingsController,
  MyBookingsController,
  QuotesController,
} from "./booking/booking.controllers";
import { HoldExpiryService } from "./booking/hold-expiry.service";
import { QuoteService } from "./booking/quote.service";
import { CatalogAdminController } from "./catalog-admin/catalog-admin.controller";
import { CatalogAdminService } from "./catalog-admin/catalog-admin.service";
import { CustomerAdminService } from "./catalog-admin/customer-admin.service";
import { CatalogController } from "./catalog/catalog.controller";
import { CatalogService } from "./catalog/catalog.service";
import { ProblemFilter } from "./common/problem";
import { APP_CONFIG, type AppConfig } from "./config/config";
import { EmailService } from "./email/email.service";
import { OutboxDispatcher } from "./email/outbox-dispatcher.service";
import { GrowthAdminController, PublicPagesController } from "./growth/growth.controllers";
import { GrowthService } from "./growth/growth.service";
import { HealthController } from "./health/health.controller";
import { IdempotencyService } from "./idempotency/idempotency.service";
import {
  AdminPaymentsController,
  MyPaymentsController,
  PaymentCallbacksController,
  SimulatorController,
} from "./payments/payment.controllers";
import { PaymentService } from "./payments/payment.service";
import { paymentProvider } from "./payments/provider.factory";
import { AdminPartnersController, PartnerPortalController } from "./partners/partner.controllers";
import { PartnerService } from "./partners/partner.service";
import { PrismaLifecycle, prismaProvider } from "./prisma/prisma.service";
import { PromotionService } from "./promotions/promotion.service";

export interface AppModuleOptions {
  config: AppConfig;
  /** Tests replace the Prisma provider with an in-memory fake. */
  prisma?: Provider;
}

@Global()
@Module({})
export class AppModule {
  static register({ config, prisma }: AppModuleOptions): DynamicModule {
    return {
      module: AppModule,
      imports: [
        // Per-process, in-memory limits for now. Moves to a Redis store with
        // the worker phase so limits hold across API instances (ADR-0008).
        ThrottlerModule.forRoot({
          throttlers: [{ name: "default", ttl: 60_000, limit: 300 }],
        }),
      ],
      controllers: [
        HealthController,
        AuthController,
        StaffAuthController,
        PartnerAuthController,
        CatalogController,
        AdminBookingsController,
        MyBookingsController,
        BookingsController,
        QuotesController,
        AdminController,
        MyPaymentsController,
        PaymentCallbacksController,
        SimulatorController,
        AdminPaymentsController,
        CatalogAdminController,
        AccountController,
        PasswordResetController,
        AdminRefundsController,
        GrowthAdminController,
        PublicPagesController,
        PartnerPortalController,
        AdminPartnersController,
        AdminSettingsController,
      ],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        prisma ?? prismaProvider,
        PrismaLifecycle,
        AuditService,
        PasswordService,
        SessionService,
        AuthService,
        CatalogService,
        BookingQueryService,
        BookingStatusService,
        BookingCreateService,
        QuoteService,
        HoldExpiryService,
        IdempotencyService,
        DashboardService,
        StaffService,
        AuditQueryService,
        paymentProvider,
        PaymentService,
        CatalogAdminService,
        CustomerAdminService,
        EmailService,
        OutboxDispatcher,
        AccountService,
        CancellationService,
        PromotionService,
        GrowthService,
        PartnerService,
        // Order matters: rate limit first, then authentication/authorization.
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_PIPE, useClass: ZodValidationPipe },
        { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
        { provide: APP_FILTER, useClass: ProblemFilter },
      ],
      exports: [APP_CONFIG],
    };
  }
}
