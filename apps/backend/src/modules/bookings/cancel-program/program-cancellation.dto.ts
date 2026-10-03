import { ApiProperty } from '@nestjs/swagger';

export class ProgramCancellationParticipantDto {
  @ApiProperty() bookingId!: string;
  @ApiProperty() clientId!: string;
  @ApiProperty() clientName!: string;
  @ApiProperty() bookingNumber!: number;
  @ApiProperty() status!: string;
  @ApiProperty() currency!: string;
  @ApiProperty({ description: 'Captured amount in integer halalas' }) paidAmount!: number;
  @ApiProperty() alreadyRefundedAmount!: number;
  @ApiProperty() pendingRefundAmount!: number;
  @ApiProperty() maxRefundAmount!: number;
  @ApiProperty({ type: Number, nullable: true }) refundAmount!: number | null;
}
export class ProgramCancellationPreviewDto {
  @ApiProperty() programId!: string;
  @ApiProperty() hasStarted!: boolean;
  @ApiProperty() quoteToken!: string;
  @ApiProperty({ type: [ProgramCancellationParticipantDto] }) participants!: ProgramCancellationParticipantDto[];
}
export class ProgramCancellationParticipantResultDto {
  @ApiProperty() bookingId!: string;
  @ApiProperty() refundAmount!: number;
  @ApiProperty() currency!: string;
  @ApiProperty({ enum: ['PENDING_REVIEW', 'PROCESSING', 'NO_REFUND'] }) refundStatus!: string;
}
export class ProgramCancellationResultDto {
  @ApiProperty() id!: string;
  @ApiProperty() status!: string;
  @ApiProperty() cancelledEnrollments!: number;
  @ApiProperty() skippedEnrollments!: number;
  @ApiProperty({ type: [ProgramCancellationParticipantResultDto] }) participants!: ProgramCancellationParticipantResultDto[];
}
