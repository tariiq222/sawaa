import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Payment, PaymentMethod, Prisma } from "@prisma/client";
import { RlsTransactionService } from "../../../infrastructure/database";
import { DEFAULT_ORG_ID } from "../../../common/constants";
import { decimalToHalalas } from "../money.helper";
import { PreviousReceiptRecordedEvent } from "../events/previous-receipt-recorded.event";
import { assertManualReceiptMethod } from "./manual-receipt-method.helper";
export interface RecordPreviousReceiptCommand {
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  receivedAt: Date;
  actorId: string;
  receiptEvidenceRef: string;
  receiptEntryReason: string;
  idempotencyKey: string;
  transaction?: Prisma.TransactionClient;
}
@Injectable()
export class RecordPreviousReceiptHandler {
  constructor(private readonly transactions: RlsTransactionService) {}
  async execute(cmd: RecordPreviousReceiptCommand): Promise<Payment> {
    const run = async (tx: Prisma.TransactionClient) => {
      const existing = await tx.payment.findUnique({
        where: { idempotencyKey: cmd.idempotencyKey },
      });
      if (existing) return this.replay(existing, cmd);
      const now = new Date();
      if (!Number.isSafeInteger(cmd.amount) || cmd.amount <= 0)
        throw new BadRequestException(
          "Receipt amount must be positive integer halalas",
        );
      if (
        !(cmd.receivedAt instanceof Date) ||
        !Number.isFinite(cmd.receivedAt.getTime()) ||
        cmd.receivedAt > now
      )
        throw new BadRequestException("RECEIPT_DATE_IN_FUTURE");
      if (
        !cmd.actorId ||
        !cmd.idempotencyKey ||
        !cmd.receiptEvidenceRef?.trim() ||
        cmd.receiptEvidenceRef.length > 200 ||
        !cmd.receiptEntryReason?.trim() ||
        cmd.receiptEntryReason.length > 500
      )
        throw new BadRequestException("Receipt audit fields are required");
      await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${cmd.invoiceId} FOR UPDATE`;
      // A waiter must recheck the key after acquiring the invoice lock.
      const raced = await tx.payment.findUnique({
        where: { idempotencyKey: cmd.idempotencyKey },
      });
      if (raced) return this.replay(raced, cmd);
      const invoice = await tx.invoice.findUnique({
        where: { id: cmd.invoiceId },
      });
      if (!invoice) throw new NotFoundException("Invoice not found");
      if (
        !invoice.bookingId ||
        !["DRAFT", "ISSUED", "PARTIALLY_PAID"].includes(invoice.status)
      )
        throw new BadRequestException(
          "Invoice cannot accept a previous receipt",
        );
      const booking = await tx.booking.findUnique({
        where: { id: invoice.bookingId },
        select: { status: true, isHistoricalImport: true },
      });
      if (
        !booking ||
        booking.isHistoricalImport ||
        !["COMPLETED", "CONFIRMED"].includes(booking.status)
      )
        throw new BadRequestException("LATE_ENTRY_FINANCIAL_STATUS_CONFLICT");
      await assertManualReceiptMethod(tx, cmd.method);
      const pending = await tx.payment.findFirst({
        where: {
          invoiceId: invoice.id,
          status: { in: ["PENDING", "PENDING_VERIFICATION"] },
        },
      });
      if (pending) throw new ConflictException("Invoice has a pending payment");
      const aggregate = await tx.payment.aggregate({
        where: {
          invoiceId: invoice.id,
          status: { in: ["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"] },
        },
        _sum: { amount: true },
      });
      const paidBefore = decimalToHalalas(aggregate._sum.amount ?? 0);
      const total = decimalToHalalas(invoice.total);
      if (cmd.amount > total - paidBefore)
        throw new BadRequestException("RECEIPT_EXCEEDS_OUTSTANDING");
      const payment = await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: cmd.amount,
          method: cmd.method,
          currency: invoice.currency,
          status: "COMPLETED",
          processedAt: now,
          effectiveReceivedAt: cmd.receivedAt,
          receiptRecordedBy: cmd.actorId,
          receiptEvidenceRef: cmd.receiptEvidenceRef,
          receiptEntryReason: cmd.receiptEntryReason,
          idempotencyKey: cmd.idempotencyKey,
        },
      });
      const status =
        paidBefore + cmd.amount === total ? "PAID" : "PARTIALLY_PAID";
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status,
          issuedAt: invoice.issuedAt ?? now,
          paidAt: status === "PAID" ? now : undefined,
        },
      });
      const event = new PreviousReceiptRecordedEvent(
        {
          invoiceId: invoice.id,
          paymentId: payment.id,
          bookingId: invoice.bookingId,
          amount: cmd.amount,
          currency: invoice.currency,
          effectiveReceivedAt: cmd.receivedAt.toISOString(),
          recordedAt: now.toISOString(),
          actorId: cmd.actorId,
          organizationId: DEFAULT_ORG_ID,
        },
        cmd.idempotencyKey,
      );
      await tx.outboxEvent.create({
        data: {
          id: event.eventId,
          aggregateId: invoice.id,
          eventType: event.eventName,
          status: "PENDING_V2",
          deliveryLane: "PENDING_V2",
          payload: event.toEnvelope() as unknown as Prisma.InputJsonValue,
        },
      });
      return payment;
    };
    if (cmd.transaction) return run(cmd.transaction);
    try {
      return await this.transactions.withTransaction(run);
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      )
        throw error;
      return this.transactions.withTransaction(async (tx) => {
        const existing = await tx.payment.findUnique({
          where: { idempotencyKey: cmd.idempotencyKey },
        });
        if (!existing) throw error;
        return this.replay(existing, cmd);
      });
    }
  }
  private replay(
    existing: Payment,
    cmd: RecordPreviousReceiptCommand,
  ): Payment {
    if (
      existing.invoiceId !== cmd.invoiceId ||
      decimalToHalalas(existing.amount) !== cmd.amount ||
      existing.method !== cmd.method ||
      existing.effectiveReceivedAt?.getTime() !== cmd.receivedAt.getTime() ||
      existing.receiptEvidenceRef !== cmd.receiptEvidenceRef ||
      existing.receiptEntryReason !== cmd.receiptEntryReason
    )
      throw new ConflictException(
        "Idempotency key already used with a different receipt",
      );
    return existing;
  }
}
