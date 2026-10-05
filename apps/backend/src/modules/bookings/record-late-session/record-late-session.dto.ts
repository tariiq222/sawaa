import { LateSessionTimestamp } from "./late-session-timestamp.helper";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { DeliveryType, PaymentMethod } from "@prisma/client";
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from "class-validator";

export const LATE_ENTRY_STATUSES = [
  "COMPLETED",
  "CONFIRMED",
  "NO_SHOW",
  "CANCELLED",
] as const;
export const LATE_PAYMENT_MODES = [
  "UNPAID",
  "PREVIOUSLY_RECEIVED",
  "COLLECT_NOW",
] as const;
export const MANUAL_RECEIPT_METHODS = [
  "CASH",
  "BANK_TRANSFER",
  "MADA",
  "TABBY",
] as const;

@ValidatorConstraint({ name: "lateEntryConditionalFields", async: false })
class LateEntryConditionalFields implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const d = args.object as RecordLateSessionDto;
    const supplied = (v: unknown) => v !== undefined;
    if (
      [
        d.paymentMethod,
        d.paymentAmountHalalas,
        d.receivedAt,
        d.receiptEvidenceRef,
        d.receiptEntryReason,
        d.cancelledAt,
        d.cancellationReason,
        d.noShowAt,
      ].some((v) => v === null)
    )
      return false;
    const previous = d.paymentMode === "PREVIOUSLY_RECEIVED";
    const paid = previous || d.paymentMode === "COLLECT_NOW";
    if (
      paid !== supplied(d.paymentMethod) ||
      paid !== supplied(d.paymentAmountHalalas)
    )
      return false;
    if (
      [d.receivedAt, d.receiptEvidenceRef, d.receiptEntryReason].some(
        (v) => supplied(v) !== previous,
      )
    )
      return false;
    if (
      supplied(d.cancelledAt) !== (d.status === "CANCELLED") ||
      supplied(d.cancellationReason) !== (d.status === "CANCELLED")
    )
      return false;
    if (supplied(d.noShowAt) !== (d.status === "NO_SHOW")) return false;
    return (
      !(
        (d.status === "CANCELLED" || d.status === "NO_SHOW") &&
        (d.amountHalalas !== 0 || paid)
      ) && !(d.amountHalalas === 0 && paid)
    );
  }
  defaultMessage() {
    return "Payment and status fields must match the selected late-entry mode";
  }
}
export class RecordLateSessionDto {
  @ApiProperty({ description: "Existing client ID", format: "uuid" })
  @IsUUID()
  clientId!: string;
  @ApiProperty({ description: "Existing branch ID", format: "uuid" })
  @IsUUID()
  branchId!: string;
  @ApiProperty({ description: "Existing practitioner ID", format: "uuid" })
  @IsUUID()
  employeeId!: string;
  @ApiProperty({ description: "Existing bound service ID", format: "uuid" })
  @IsUUID()
  serviceId!: string;
  @ApiProperty({ enum: DeliveryType, description: "Actual delivery channel" })
  @IsEnum(DeliveryType)
  deliveryType!: DeliveryType;
  @ApiProperty({ description: "Actual session start", format: "date-time" })
  @Validate(LateSessionTimestamp)
  scheduledAt!: string;
  @ApiProperty({
    description: "Actual session duration in minutes",
    example: 60,
  })
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMins!: number;
  @ApiProperty({
    enum: LATE_ENTRY_STATUSES,
    description: "Recorded session status",
  })
  @IsIn(LATE_ENTRY_STATUSES)
  status!: (typeof LATE_ENTRY_STATUSES)[number];
  @ApiProperty({
    description: "Actual net amount in integer halalas",
    example: 40000,
  })
  @IsInt()
  @Min(0)
  @Max(9999999999)
  amountHalalas!: number;
  @ApiPropertyOptional({ description: "Session notes" })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
  @ApiProperty({
    enum: LATE_PAYMENT_MODES,
    description: "Financial recording mode",
  })
  @IsIn(LATE_PAYMENT_MODES)
  @Validate(LateEntryConditionalFields)
  paymentMode!: (typeof LATE_PAYMENT_MODES)[number];
  @ApiProperty({
    description: "Stable operation key",
    example: "late-session-123",
  })
  @IsString()
  @Matches(/\S/)
  @MaxLength(128)
  creationIdempotencyKey!: string;
  @ApiPropertyOptional({
    enum: MANUAL_RECEIPT_METHODS,
    description: "Manual collection method",
  })
  @IsOptional()
  @IsIn(MANUAL_RECEIPT_METHODS)
  paymentMethod?: PaymentMethod;
  @ApiPropertyOptional({
    description: "Amount received in integer halalas",
    example: 15000,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9999999999)
  paymentAmountHalalas?: number;
  @ApiPropertyOptional({
    description: "Actual previous receipt time",
    format: "date-time",
  })
  @IsOptional()
  @Validate(LateSessionTimestamp)
  receivedAt?: string;
  @ApiPropertyOptional({ description: "Previous receipt evidence reference" })
  @IsOptional()
  @IsString()
  @Matches(/\S/)
  @MaxLength(200)
  receiptEvidenceRef?: string;
  @ApiPropertyOptional({
    description: "Reason for documenting a previous receipt",
  })
  @IsOptional()
  @IsString()
  @Matches(/\S/)
  @MaxLength(500)
  receiptEntryReason?: string;
  @ApiPropertyOptional({
    description: "Actual cancellation time",
    format: "date-time",
  })
  @IsOptional()
  @Validate(LateSessionTimestamp)
  cancelledAt?: string;
  @ApiPropertyOptional({ description: "Actual cancellation reason" })
  @IsOptional()
  @IsString()
  @Matches(/\S/)
  @MaxLength(500)
  cancellationReason?: string;
  @ApiPropertyOptional({
    description: "Actual no-show determination time",
    format: "date-time",
  })
  @IsOptional()
  @Validate(LateSessionTimestamp)
  noShowAt?: string;
}
