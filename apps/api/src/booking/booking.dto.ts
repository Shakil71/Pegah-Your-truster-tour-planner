import {
  AdminBookingListQuerySchema,
  CancelBookingRequestSchema,
  CreateBookingRequestSchema,
  HotelQuoteQuerySchema,
  QuoteSchema,
  TourQuoteQuerySchema,
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

/** A discriminated union cannot be a class; used for OpenAPI via @ApiBody, validated by an explicit pipe. */
export const CreateBookingRequestDto = createZodDto(CreateBookingRequestSchema);
// Names the schema in the OpenAPI document (a class would get its name for free).
Object.defineProperty(CreateBookingRequestDto, "name", { value: "CreateBookingRequestDto" });
export class CancelBookingRequestDto extends createZodDto(CancelBookingRequestSchema) {}
export class HotelQuoteQueryDto extends createZodDto(HotelQuoteQuerySchema) {}
export class TourQuoteQueryDto extends createZodDto(TourQuoteQuerySchema) {}
export class QuoteDto extends createZodDto(QuoteSchema) {}
