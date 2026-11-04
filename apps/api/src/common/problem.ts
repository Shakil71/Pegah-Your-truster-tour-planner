import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Problem } from "@pegah/contracts";
import { Prisma } from "@pegah/db";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodValidationException } from "nestjs-zod";
import { ZodError } from "zod";

/**
 * Throw this for business errors. `type` is a stable, documented slug that
 * clients can branch on; `detail` is safe to show to the end user.
 */
export class ProblemException extends HttpException {
  constructor(
    status: number,
    readonly slug: string,
    readonly title: string,
    readonly detail?: string,
  ) {
    super({ slug, title, detail }, status);
  }
}

const STATUS_TITLES: Record<number, string> = {
  400: "Bad request",
  401: "Authentication required",
  403: "Forbidden",
  404: "Not found",
  405: "Method not allowed",
  409: "Conflict",
  413: "Payload too large",
  415: "Unsupported media type",
  422: "Unprocessable content",
  429: "Too many requests",
  500: "Internal server error",
  503: "Service unavailable",
};

/** Prisma error codes meaning "database unreachable or saturated", not a bug. */
const DB_UNAVAILABLE_CODES = new Set(["P1001", "P1002", "P1008", "P1017", "P2024", "P2039"]);

function isDatabaseUnavailable(exception: unknown): boolean {
  if (exception instanceof Prisma.PrismaClientInitializationError) return true;
  return (
    exception instanceof Prisma.PrismaClientKnownRequestError &&
    DB_UNAVAILABLE_CODES.has(exception.code)
  );
}

function slugFor(status: number): string {
  return (STATUS_TITLES[status] ?? "error").toLowerCase().replace(/[^a-z]+/g, "-");
}

/** RFC 9457 problem details for every error the API returns. */
@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly logger = new Logger("Errors");

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();
    const problem = this.toProblem(exception, request);

    if (problem.status >= 500) {
      // Log the cause server-side; never echo internals to the client.
      this.logger.error(
        { err: exception, requestId: request.id, url: request.routeOptions?.url },
        "Unhandled error",
      );
    }

    void reply
      .status(problem.status)
      .header("content-type", "application/problem+json; charset=utf-8")
      .send(problem);
  }

  private toProblem(exception: unknown, request: FastifyRequest): Problem {
    const base = { instance: request.url.split("?")[0], requestId: String(request.id) };

    if (exception instanceof ZodValidationException) {
      const error = exception.getZodError();
      const issues = error instanceof ZodError ? error.issues : [];
      return {
        type: "/problems/validation",
        title: "Validation failed",
        status: 400,
        detail: "One or more fields are invalid.",
        errors: issues.map((i) => ({
          path: i.path.map(String).join("."),
          message: i.message,
          code: i.code,
        })),
        ...base,
      };
    }

    if (exception instanceof ProblemException) {
      return {
        type: `/problems/${exception.slug}`,
        title: exception.title,
        status: exception.getStatus(),
        ...(exception.detail ? { detail: exception.detail } : {}),
        ...base,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return {
        type: `/problems/${slugFor(status)}`,
        title: STATUS_TITLES[status] ?? "Error",
        status,
        ...base,
      };
    }

    if (isDatabaseUnavailable(exception)) {
      return {
        type: "/problems/service-unavailable",
        title: STATUS_TITLES[503]!,
        status: 503,
        detail: "We are having trouble reaching our systems. Please try again shortly.",
        ...base,
      };
    }

    // Fastify-level errors (malformed JSON, body too large) carry statusCode.
    const statusCode = (exception as { statusCode?: unknown })?.statusCode;
    if (typeof statusCode === "number" && statusCode >= 400 && statusCode < 500) {
      return {
        type: `/problems/${slugFor(statusCode)}`,
        title: STATUS_TITLES[statusCode] ?? "Bad request",
        status: statusCode,
        ...base,
      };
    }

    return {
      type: "/problems/internal",
      title: STATUS_TITLES[HttpStatus.INTERNAL_SERVER_ERROR]!,
      status: 500,
      detail: "Something went wrong on our side. Please try again.",
      ...base,
    };
  }
}
