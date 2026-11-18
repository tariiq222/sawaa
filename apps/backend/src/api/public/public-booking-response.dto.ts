import { ApiProperty } from '@nestjs/swagger';
import { ClientBookingMutationDto } from '../client/dto/client-booking-response.dto';

/**
 * Swagger response shape for `PATCH /public/me/bookings/{id}/reschedule`.
 *
 * The controller returns `{ ...result, booking: projectClientBookingMutation(result.booking) }`,
 * i.e. the same client-safe booking projection that the `/client/bookings`
 * area already documents. The projection is typed `Partial<Booking>` (it copies
 * an allow-list of own keys), so the controller return stays INFERRED and this
 * DTO is the wire contract — exactly the convention `client/bookings.controller.ts`
 * uses for the same projection. `client-response.dto.spec.ts` pins the
 * projection allow-list; the public spec re-asserts it.
 *
 * Documentation only — no serializer is registered.
 */
export class PublicBookingRescheduleResponseDto {
  @ApiProperty({
    type: ClientBookingMutationDto,
    description:
      'The rescheduled booking, client-safe projection (no staff notes, provider diagnostics or Zoom host capabilities).',
  })
  booking!: ClientBookingMutationDto;
}
