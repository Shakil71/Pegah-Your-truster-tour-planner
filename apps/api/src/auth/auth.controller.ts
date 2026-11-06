import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { ChangePasswordSchema, type SessionKind, type SessionResponse } from "@pegah/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import { createZodDto, ZodResponse } from "nestjs-zod";
import { AccountService } from "../account/account.service";
import { EmailVerificationService } from "../account/email-verification.service";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { LoginRequestDto, RegisterRequestDto, SessionResponseDto } from "./auth.dto";
import { AuthService, type IssuedSession } from "./auth.service";
import type { AuthContext } from "./auth.types";
import { CurrentAuth, PartnerPortal, Public, Staff } from "./decorators";
import { SessionService, type SessionMeta } from "./session.service";

class StaffChangePasswordDto extends createZodDto(ChangePasswordSchema) {}

function sessionMeta(request: FastifyRequest): SessionMeta {
  const ua = request.headers["user-agent"];
  return { ipAddress: request.ip ?? null, userAgent: typeof ua === "string" ? ua : null };
}

/** Shared cookie handling for the customer and staff controllers. */
abstract class SessionCookieController {
  constructor(
    protected readonly auth: AuthService,
    protected readonly sessions: SessionService,
    protected readonly config: AppConfig,
  ) {}

  protected issue(reply: FastifyReply, kind: SessionKind, issued: IssuedSession): SessionResponse {
    void reply.setCookie(this.sessions.cookieName(kind), issued.token, {
      httpOnly: true,
      secure: this.config.COOKIE_SECURE,
      sameSite: "lax",
      path: "/",
      maxAge: issued.maxAgeSeconds,
    });
    void reply.header("cache-control", "no-store");
    return issued.response;
  }

  protected clear(reply: FastifyReply, kind: SessionKind): void {
    void reply.clearCookie(this.sessions.cookieName(kind), {
      httpOnly: true,
      secure: this.config.COOKIE_SECURE,
      sameSite: "lax",
      path: "/",
    });
  }
}

@ApiTags("auth")
@Controller("auth")
export class AuthController extends SessionCookieController {
  constructor(
    @Inject(AuthService) auth: AuthService,
    @Inject(SessionService) sessions: SessionService,
    @Inject(APP_CONFIG) config: AppConfig,
    @Inject(EmailVerificationService) private readonly verification: EmailVerificationService,
  ) {
    super(auth, sessions, config);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("register")
  @HttpCode(201)
  @ZodResponse({
    status: 201,
    type: SessionResponseDto,
    description: "Account created and signed in",
  })
  async register(
    @Body() body: RegisterRequestDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    // Emails follow the language the website was shown in (next-intl cookie, ADR-0036).
    const locale = request.cookies?.NEXT_LOCALE === "bn" ? "bn" : "en";
    const issued = await this.auth.register(body, sessionMeta(request), locale);
    await this.verification.sendAfterRegister(issued.response.user.id, request.ip ?? null);
    return this.issue(reply, "CUSTOMER", issued);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("login")
  @HttpCode(200)
  @ZodResponse({ status: 200, type: SessionResponseDto })
  async login(
    @Body() body: LoginRequestDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.issue(
      reply,
      "CUSTOMER",
      await this.auth.login(body, "CUSTOMER", sessionMeta(request)),
    );
  }

  @ApiCookieAuth("customer")
  @Post("logout")
  @HttpCode(204)
  async logout(@CurrentAuth() auth: AuthContext, @Res({ passthrough: true }) reply: FastifyReply) {
    await this.auth.logout(auth);
    this.clear(reply, "CUSTOMER");
  }

  @ApiCookieAuth("customer")
  @Get("session")
  @ZodResponse({ status: 200, type: SessionResponseDto })
  session(@CurrentAuth() auth: AuthContext, @Res({ passthrough: true }) reply: FastifyReply) {
    void reply.header("cache-control", "no-store");
    return this.auth.toSessionResponse(auth);
  }
}

@ApiTags("staff-auth")
@Staff()
@Controller("staff/auth")
export class StaffAuthController extends SessionCookieController {
  constructor(
    @Inject(AuthService) auth: AuthService,
    @Inject(SessionService) sessions: SessionService,
    @Inject(APP_CONFIG) config: AppConfig,
    @Inject(AccountService) private readonly account: AccountService,
  ) {
    super(auth, sessions, config);
  }

  /** Staff change their own password; every other session of theirs is signed out. */
  @ApiCookieAuth("staff")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("password")
  @HttpCode(204)
  async changePassword(
    @CurrentAuth() auth: AuthContext,
    @Body() body: StaffChangePasswordDto,
    @Req() request: FastifyRequest,
  ) {
    await this.account.changePassword(auth, body, request.ip ?? null);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("login")
  @HttpCode(200)
  @ZodResponse({ status: 200, type: SessionResponseDto })
  async login(
    @Body() body: LoginRequestDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.issue(reply, "STAFF", await this.auth.login(body, "STAFF", sessionMeta(request)));
  }

  @ApiCookieAuth("staff")
  @Post("logout")
  @HttpCode(204)
  async logout(@CurrentAuth() auth: AuthContext, @Res({ passthrough: true }) reply: FastifyReply) {
    await this.auth.logout(auth);
    this.clear(reply, "STAFF");
  }

  @ApiCookieAuth("staff")
  @Get("session")
  @ZodResponse({ status: 200, type: SessionResponseDto })
  session(@CurrentAuth() auth: AuthContext, @Res({ passthrough: true }) reply: FastifyReply) {
    void reply.header("cache-control", "no-store");
    return this.auth.toSessionResponse(auth);
  }
}

@ApiTags("partner-auth")
@PartnerPortal()
@Controller("partner/auth")
export class PartnerAuthController extends SessionCookieController {
  constructor(
    @Inject(AuthService) auth: AuthService,
    @Inject(SessionService) sessions: SessionService,
    @Inject(APP_CONFIG) config: AppConfig,
    @Inject(AccountService) private readonly account: AccountService,
  ) {
    super(auth, sessions, config);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("login")
  @HttpCode(200)
  @ZodResponse({ status: 200, type: SessionResponseDto })
  async login(
    @Body() body: LoginRequestDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.issue(
      reply,
      "PARTNER",
      await this.auth.login(body, "PARTNER", sessionMeta(request)),
    );
  }

  @ApiCookieAuth("partner")
  @Post("logout")
  @HttpCode(204)
  async logout(@CurrentAuth() auth: AuthContext, @Res({ passthrough: true }) reply: FastifyReply) {
    await this.auth.logout(auth);
    this.clear(reply, "PARTNER");
  }

  @ApiCookieAuth("partner")
  @Get("session")
  @ZodResponse({ status: 200, type: SessionResponseDto })
  session(@CurrentAuth() auth: AuthContext, @Res({ passthrough: true }) reply: FastifyReply) {
    void reply.header("cache-control", "no-store");
    return this.auth.toSessionResponse(auth);
  }

  /** Partner users change their own password; other sessions are signed out. */
  @ApiCookieAuth("partner")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("password")
  @HttpCode(204)
  async changePassword(
    @CurrentAuth() auth: AuthContext,
    @Body() body: StaffChangePasswordDto,
    @Req() request: FastifyRequest,
  ) {
    await this.account.changePassword(auth, body, request.ip ?? null);
  }
}
