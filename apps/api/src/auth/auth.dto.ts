import { LoginRequestSchema, RegisterRequestSchema, SessionResponseSchema } from "@pegah/contracts";
import { createZodDto } from "nestjs-zod";

export class RegisterRequestDto extends createZodDto(RegisterRequestSchema) {}
export class LoginRequestDto extends createZodDto(LoginRequestSchema) {}
export class SessionResponseDto extends createZodDto(SessionResponseSchema) {}
