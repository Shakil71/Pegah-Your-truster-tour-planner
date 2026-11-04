import {
  AdminBookingListQuerySchema,
  BookingDetailSchema,
  BookingListResponseSchema,
  BookingStatusTransitionRequestSchema,
  PaginationQuerySchema,
} from "@pegah/contracts";
import { createZodDto } from "nestjs-zod";

export class AdminBookingListQueryDto extends createZodDto(AdminBookingListQuerySchema) {}
export class BookingListResponseDto extends createZodDto(BookingListResponseSchema) {}
export class BookingDetailDto extends createZodDto(BookingDetailSchema) {}
export class BookingStatusTransitionRequestDto extends createZodDto(
  BookingStatusTransitionRequestSchema,
) {}
export class PaginationQueryDto extends createZodDto(PaginationQuerySchema) {}
