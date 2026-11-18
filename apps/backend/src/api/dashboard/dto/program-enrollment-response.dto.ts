import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';

/**
 * Swagger response shape for `POST /dashboard/programs/{id}/enrollments`
 * (`EnrollInProgramHandler.execute` → `EnrollInProgramResult`).
 *
 * Documentation only: the handler keeps its inferred return type and nothing
 * under `src/modules/**` imports this layer. The booking is created in a group
 * awaiting payment, so `invoiceId` is null only for a zero-price program.
 */
export class ProgramEnrollmentCreatedResponseDto {
  @ApiProperty({
    enum: ['ENROLLED'],
    description: 'Result discriminator: the client was enrolled',
    example: 'ENROLLED',
  })
  type!: 'ENROLLED';

  @ApiProperty({
    format: 'uuid',
    description: 'Booking created for the enrollment',
    example: '44444444-4444-4444-8444-444444444444',
  })
  bookingId!: string;

  @ApiProperty({
    enum: BookingStatus,
    description: 'Lifecycle status of the created booking',
    example: 'PENDING_GROUP_FILL',
  })
  status!: BookingStatus;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Invoice issued for the enrollment, or null when no payment is due',
    example: '00000000-0000-4000-a000-000000000042',
  })
  invoiceId!: string | null;
}
