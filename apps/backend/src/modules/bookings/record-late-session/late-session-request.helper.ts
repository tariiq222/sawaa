import { parseLateSessionTimestamp } from "./late-session-timestamp.helper";
import { createHash } from "crypto";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { JwtUser } from "../../../common/auth/current-user.decorator";
import { CaslAbilityFactory } from "../../identity/casl/casl-ability.factory";
import { RecordLateSessionDto } from "./record-late-session.dto";
export function validateLateSessionRequest(
  input: RecordLateSessionDto,
  actor: JwtUser,
) {
  const dto = plainToInstance(RecordLateSessionDto, input);
  if (validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).length)
    throw new BadRequestException("Invalid late session fields");
  const factory = new CaslAbilityFactory();
  const ability = Array.isArray(actor.permissions)
    ? factory.buildFromPermissions(actor.permissions)
    : factory.buildForUser({ ...actor, customRole: actor.customRole ?? null });
  if (
    !actor.sub ||
    !ability.can("create", "Booking") ||
    (dto.amountHalalas > 0 && !ability.can("create", "Invoice")) ||
    (dto.paymentMode !== "UNPAID" && !ability.can("create", "Payment"))
  )
    throw new ForbiddenException(
      "Insufficient permissions for late session financial records",
    );
  return dto;
}
export function lateSessionRequestHash(dto: RecordLateSessionDto) {
  const canonical = {
    version: 1,
    clientId: dto.clientId,
    branchId: dto.branchId,
    employeeId: dto.employeeId,
    serviceId: dto.serviceId,
    deliveryType: dto.deliveryType,
    scheduledAt: parseLateSessionTimestamp(dto.scheduledAt).toISOString(),
    durationMins: dto.durationMins,
    status: dto.status,
    amountHalalas: dto.amountHalalas,
    notes: dto.notes ?? null,
    paymentMode: dto.paymentMode,
    paymentMethod: dto.paymentMethod ?? null,
    paymentAmountHalalas: dto.paymentAmountHalalas ?? null,
    receivedAt:
      dto.receivedAt !== undefined
        ? parseLateSessionTimestamp(dto.receivedAt).toISOString()
        : null,
    receiptEvidenceRef: dto.receiptEvidenceRef ?? null,
    receiptEntryReason: dto.receiptEntryReason ?? null,
    cancelledAt:
      dto.cancelledAt !== undefined
        ? parseLateSessionTimestamp(dto.cancelledAt).toISOString()
        : null,
    cancellationReason: dto.cancellationReason ?? null,
    noShowAt:
      dto.noShowAt !== undefined
        ? parseLateSessionTimestamp(dto.noShowAt).toISOString()
        : null,
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
export function lateSessionTimes(dto: RecordLateSessionDto, now: Date) {
  if (
    !(now instanceof Date) ||
    !Number.isFinite(now.getTime()) ||
    !Number.isSafeInteger(dto.durationMins) ||
    dto.durationMins <= 0
  ) {
    throw new BadRequestException("Invalid late-entry clock or duration");
  }
  const scheduledAt = parseLateSessionTimestamp(dto.scheduledAt),
    endsAt = new Date(scheduledAt.getTime() + dto.durationMins * 60000);
  if (!Number.isFinite(endsAt.getTime()))
    throw new BadRequestException("Invalid session end time");
  if (scheduledAt >= now) throw new BadRequestException("LATE_ENTRY_NOT_PAST");
  if (dto.status === "COMPLETED" && endsAt >= now)
    throw new BadRequestException("LATE_ENTRY_SESSION_NOT_ENDED");
  const cancelledAt =
      dto.cancelledAt !== undefined
        ? parseLateSessionTimestamp(dto.cancelledAt)
        : null,
    noShowAt =
      dto.noShowAt !== undefined
        ? parseLateSessionTimestamp(dto.noShowAt)
        : null;
  if (cancelledAt && cancelledAt > now)
    throw new BadRequestException("Cancellation date is in the future");
  if (noShowAt && (noShowAt < scheduledAt || noShowAt > now))
    throw new BadRequestException(
      "No-show time must be between session start and recording time",
    );
  if (
    dto.receivedAt !== undefined &&
    parseLateSessionTimestamp(dto.receivedAt) > now
  )
    throw new BadRequestException("RECEIPT_DATE_IN_FUTURE");
  return { scheduledAt, endsAt, cancelledAt, noShowAt };
}
