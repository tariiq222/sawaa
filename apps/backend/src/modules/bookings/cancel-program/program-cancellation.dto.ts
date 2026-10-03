import { ApiProperty } from '@nestjs/swagger';

export class ProgramCancellationParticipantDto {
  @ApiProperty({ description: 'Booking identifier for this enrolled participant', example: '11111111-1111-4111-8111-111111111111' }) bookingId!: string;
  @ApiProperty({ description: 'Client identifier for this enrolled participant', example: '22222222-2222-4222-8222-222222222222' }) clientId!: string;
  @ApiProperty({ description: 'Display name of the enrolled client', example: 'سارة محمد' }) clientName!: string;
  @ApiProperty({ description: 'Human-readable booking number for this participant', example: 1042 }) bookingNumber!: number;
  @ApiProperty({ description: 'Current booking status when the cancellation preview was generated', example: 'CONFIRMED' }) status!: string;
  @ApiProperty({ description: 'Currency shared by the booking and its captured payments', example: 'SAR' }) currency!: string;
  @ApiProperty({ description: 'Captured original amount in integer halalas, before refunds', example: 30000 }) paidAmount!: number;
  @ApiProperty({ description: 'Amount already refunded in integer halalas', example: 5000 }) alreadyRefundedAmount!: number;
  @ApiProperty({ description: 'Amount reserved by pending refund requests in integer halalas', example: 5000 }) pendingRefundAmount!: number;
  @ApiProperty({ description: 'Maximum additional refund in integer halalas after existing refunds and reservations; zero for historical imports', example: 20000 }) maxRefundAmount!: number;
  @ApiProperty({ type: Number, nullable: true, description: 'Additional refund in integer halalas: the full available amount before program start, or null after start until staff select an amount', example: 20000 }) refundAmount!: number | null;
}
export class ProgramCancellationPreviewDto {
  @ApiProperty({ description: 'Program identifier for this cancellation preview', example: '33333333-3333-4333-8333-333333333333' }) programId!: string;
  @ApiProperty({ description: 'Whether the start date has elapsed or participant attendance, completion or historical-import evidence requires post-start refund selection', example: false }) hasStarted!: boolean;
  @ApiProperty({ description: 'Opaque token for these cancellation terms; submit it unchanged when cancelling and refresh the preview if the terms change', example: 'a9b7c3d5e1f02468a9b7c3d5e1f02468a9b7c3d5e1f02468a9b7c3d5e1f02468' }) quoteToken!: string;
  @ApiProperty({ type: [ProgramCancellationParticipantDto], description: 'Current enrolled participants and their individual refundable balances, including bookings whose history must be retained', example: [{ bookingId: '11111111-1111-4111-8111-111111111111', clientId: '22222222-2222-4222-8222-222222222222', clientName: 'سارة محمد', bookingNumber: 1042, status: 'CONFIRMED', currency: 'SAR', paidAmount: 30000, alreadyRefundedAmount: 5000, pendingRefundAmount: 5000, maxRefundAmount: 20000, refundAmount: 20000 }] }) participants!: ProgramCancellationParticipantDto[];
}
export class ProgramCancellationParticipantResultDto {
  @ApiProperty({ description: 'Booking identifier for this participant cancellation outcome', example: '11111111-1111-4111-8111-111111111111' }) bookingId!: string;
  @ApiProperty({ description: 'Additional refund amount recorded by this cancellation in integer halalas; does not mean the refund has completed', example: 20000 }) refundAmount!: number;
  @ApiProperty({ description: 'Currency of this participant refund amount', example: 'SAR' }) currency!: string;
  @ApiProperty({ enum: ['PENDING_REVIEW', 'PROCESSING', 'NO_REFUND'], description: 'Initial refund outcome: staff review required, automatic processing pending, or no additional refund', example: 'PENDING_REVIEW' }) refundStatus!: string;
}
export class ProgramCancellationResultDto {
  @ApiProperty({ description: 'Identifier of the cancelled program', example: '33333333-3333-4333-8333-333333333333' }) id!: string;
  @ApiProperty({ description: 'Program status after cancellation is committed', example: 'CANCELLED' }) status!: string;
  @ApiProperty({ description: 'Number of participant bookings transitioned to CANCELLED by this operation', example: 1 }) cancelledEnrollments!: number;
  @ApiProperty({ description: 'Number of participant bookings whose status was retained, including terminal bookings and historical imports', example: 0 }) skippedEnrollments!: number;
  @ApiProperty({ type: [ProgramCancellationParticipantResultDto], description: 'Per-participant refund outcomes for non-historical bookings, including terminal bookings whose status was retained', example: [{ bookingId: '11111111-1111-4111-8111-111111111111', refundAmount: 20000, currency: 'SAR', refundStatus: 'PENDING_REVIEW' }] }) participants!: ProgramCancellationParticipantResultDto[];
}
