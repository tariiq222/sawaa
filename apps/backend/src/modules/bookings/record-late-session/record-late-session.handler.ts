import { ConflictException, Injectable } from "@nestjs/common";
import { Booking, Prisma } from "@prisma/client";
import { RlsTransactionService } from "../../../infrastructure/database";
import { JwtUser } from "../../../common/auth/current-user.decorator";
import { retrySerializableTransaction } from "../../../common/database/person-reference-lock.helper";
import { ProcessPaymentHandler } from "../../finance/process-payment/process-payment.handler";
import { RecordPreviousReceiptHandler } from "../../finance/record-previous-receipt/record-previous-receipt.handler";
import { assertManualReceiptMethod } from "../../finance/record-previous-receipt/manual-receipt-method.helper";
import { resolveVatRate } from "../../finance/create-invoice/create-invoice.handler";
import { computeVat } from "../../finance/money.helper";
import { hashToInt32 } from "../booking-lifecycle.helper";
import { RecordLateSessionDto } from "./record-late-session.dto";
import {
  lateSessionRequestHash,
  lateSessionTimes,
  validateLateSessionRequest,
} from "./late-session-request.helper";
import {
  assertNoLateSessionOverlap,
  isLateSessionExclusionConflict,
  findLateSessionConstraintConflict,
  lateSessionOverlapConflict,
  lockLateSessionReferences,
} from "./late-session-references.helper";
import { lateSessionResult } from "./late-session-result.helper";
@Injectable()
export class RecordLateSessionHandler {
  constructor(
    private readonly transactions: RlsTransactionService,
    private readonly previousReceipt: RecordPreviousReceiptHandler,
    private readonly processPayment: ProcessPaymentHandler,
  ) {}
  async execute(input: RecordLateSessionDto, actor: JwtUser) {
    const dto = validateLateSessionRequest(input, actor),
      hash = lateSessionRequestHash(dto);
    const replay = async (tx: Prisma.TransactionClient, booking: Booking) => {
      if (!booking.lateEntryRecordedAt || booking.creationRequestHash !== hash)
        throw new ConflictException(
          "Creation key already used with a different request",
        );
      return lateSessionResult(tx, booking);
    };
    try {
      return await retrySerializableTransaction(() =>
        this.transactions.withTransaction(
          async (tx) => {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(${hashToInt32("client_booking")}::int,${hashToInt32(dto.clientId)}::int)`;
            const existing = await tx.booking.findUnique({
              where: { creationIdempotencyKey: dto.creationIdempotencyKey },
            });
            if (existing) return replay(tx, existing);
            const now = new Date(),
              times = lateSessionTimes(dto, now);
            const refs = await lockLateSessionReferences(tx, dto);
            await assertNoLateSessionOverlap(
              tx,
              dto,
              times.scheduledAt,
              times.endsAt,
            );
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(${hashToInt32("booking_number")}::int,0::int)`;
            const last = await tx.booking.findFirst({
              where: {},
              orderBy: { bookingNumber: "desc" },
              select: { bookingNumber: true },
            });
            const booking = await tx.booking.create({
              data: {
                clientId: dto.clientId,
                branchId: dto.branchId,
                employeeId: dto.employeeId,
                serviceId: dto.serviceId,
                bookingType: "INDIVIDUAL",
                deliveryType: dto.deliveryType,
                source: "RECEPTION",
                isHistoricalImport: false,
                status: dto.status,
                ...times,
                durationMins: dto.durationMins,
                price: dto.amountHalalas,
                currency: refs.service.currency,
                notes: dto.notes,
                creationIdempotencyKey: dto.creationIdempotencyKey,
                creationRequestHash: hash,
                lateEntryRecordedAt: now,
                lateEntryRecordedBy: actor.sub,
                completedAt: dto.status === "COMPLETED" ? times.endsAt : null,
                confirmedAt: null,
                cancelReason: dto.status === "CANCELLED" ? "OTHER" : null,
                cancelNotes: dto.cancellationReason ?? null,
                payAtClinic: true,
                priceSnapshot: new Prisma.Decimal(dto.amountHalalas),
                durationMinutesSnapshot: dto.durationMins,
                branchNameSnapshot: refs.branch.nameAr,
                employeeNameSnapshot: refs.employee.name,
                serviceNameSnapshot: refs.service.nameAr,
                categoryNameSnapshot: refs.service.category?.nameAr ?? null,
                departmentNameSnapshot:
                  refs.service.category?.department?.nameAr ?? null,
                bookingNumber: (last?.bookingNumber ?? 0) + 1,
              },
            });
            await tx.bookingStatusLog.create({
              data: {
                bookingId: booking.id,
                fromStatus: null,
                toStatus: dto.status,
                changedBy: actor.sub,
                createdAt: now,
                reason: `Late session recorded; actual start ${times.scheduledAt.toISOString()}${dto.cancellationReason ? `; ${dto.cancellationReason}` : ""}`,
              },
            });
            if (dto.amountHalalas > 0) {
              const vatRate = await resolveVatRate(tx),
                money = computeVat(
                  new Prisma.Decimal(dto.amountHalalas),
                  vatRate,
                );
              const invoice = await tx.invoice.create({
                data: {
                  bookingId: booking.id,
                  branchId: dto.branchId,
                  clientId: dto.clientId,
                  employeeId: dto.employeeId,
                  subtotal: dto.amountHalalas,
                  discountAmt: 0,
                  vatRate,
                  vatAmt: money.vatAmtHalalas,
                  total: money.totalHalalas,
                  currency: booking.currency,
                  status: "DRAFT",
                },
              });
              if (dto.paymentMode === "PREVIOUSLY_RECEIVED")
                await this.previousReceipt.execute({
                  invoiceId: invoice.id,
                  amount: dto.paymentAmountHalalas!,
                  method: dto.paymentMethod!,
                  receivedAt: new Date(dto.receivedAt!),
                  actorId: actor.sub,
                  receiptEvidenceRef: dto.receiptEvidenceRef!,
                  receiptEntryReason: dto.receiptEntryReason!,
                  idempotencyKey: `late:${dto.creationIdempotencyKey}`,
                  transaction: tx,
                });
              if (dto.paymentMode === "COLLECT_NOW") {
                await assertManualReceiptMethod(tx, dto.paymentMethod!);
                await this.processPayment.execute({
                  invoiceId: invoice.id,
                  amount: dto.paymentAmountHalalas!,
                  method: dto.paymentMethod!,
                  idempotencyKey: `late:${dto.creationIdempotencyKey}`,
                  transaction: tx,
                });
              }
            }
            return lateSessionResult(tx, booking);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        ),
      );
    } catch (error) {
      if (isLateSessionExclusionConflict(error)) {
        // A failed insert aborts the transaction. Locate the committed blocker
        // (including imports) using a fresh transaction, never the aborted one.
        const conflict = await this.transactions.withTransaction((tx) =>
          findLateSessionConstraintConflict(tx, dto),
        );
        throw lateSessionOverlapConflict(conflict?.id);
      }
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      )
        throw error;
      // A uniqueness violation aborts PostgreSQL's transaction: recover only here.
      return this.transactions.withTransaction(async (tx) => {
        const winner = await tx.booking.findUnique({
          where: { creationIdempotencyKey: dto.creationIdempotencyKey },
        });
        if (!winner) throw error;
        return replay(tx, winner);
      });
    }
  }
}
