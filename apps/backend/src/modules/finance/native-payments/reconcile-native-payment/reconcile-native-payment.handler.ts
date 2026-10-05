import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { nativePaymentUnavailableReason } from "../native-payment-eligibility";
import type { NativePaymentReconcileResponse } from "@sawaa/shared/types";
import { PrismaService } from "../../../../infrastructure/database";
import { DEFAULT_ORG_ID } from "../../../../common/constants";
import { MoyasarApiClient } from "../../moyasar-api/moyasar-api.client";
import { MoyasarPaymentSettlementHandler } from "../../moyasar-payment-settlement/moyasar-payment-settlement.handler";

@Injectable()
export class ReconcileNativePaymentHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moyasar: MoyasarApiClient,
    private readonly settlement: MoyasarPaymentSettlementHandler,
  ) {}
  async execute(cmd: {
    clientId: string;
    paymentId: string;
  }): Promise<NativePaymentReconcileResponse> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: cmd.paymentId },
    });
    if (!payment) throw new NotFoundException("Payment not found");
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: payment.invoiceId },
    });
    if (!invoice || invoice.clientId !== cmd.clientId)
      throw new ForbiddenException("Payment does not belong to this client");
    if (payment.gatewayRef !== payment.id)
      throw new ConflictException({
        code: "HOSTED_PAYMENT_IN_PROGRESS",
        message: "Payment is not a native attempt",
      });
    const result = (
      status: typeof payment.status,
      requiresReview = false,
    ): NativePaymentReconcileResponse => ({
      paymentId: payment.id,
      invoiceId: payment.invoiceId,
      status: status as NativePaymentReconcileResponse["status"],
      requiresReview,
    });
    let fetched;
    try {
      fetched = await this.moyasar.getPaymentStatus(
        DEFAULT_ORG_ID,
        payment.gatewayRef,
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        // Provider absence does not establish payment or target state. Both may
        // have changed while the remote request was in flight. Init remains the
        // final locked gate before exposing SDK configuration for this same UUID.
        const current = await this.prisma.payment.findUnique({
          where: { id: payment.id },
        });
        if (!current || current.invoiceId !== payment.invoiceId ||
            current.gatewayRef !== payment.gatewayRef ||
            current.nativeConfigFingerprint !== payment.nativeConfigFingerprint ||
            Number(current.amount) !== Number(payment.amount) ||
            current.currency !== payment.currency)
          throw new ConflictException("Payment changed during reconciliation");
        const currentInvoice = await this.prisma.invoice.findFirst({
          where: { id: current.invoiceId },
        });
        if (!currentInvoice || currentInvoice.clientId !== cmd.clientId)
          throw new ForbiddenException("Payment does not belong to this client");
        const review = await this.prisma.refundRequest.findFirst({
          where: { paymentId: current.id, status: "PENDING_REVIEW" },
          select: { id: true },
        });
        // Completion and manual review take precedence over an unavailable target.
        if (current.status !== "PENDING" || review)
          return result(current.status, !!review);
        const booking = currentInvoice.bookingId
          ? await this.prisma.booking.findFirst({ where: { id: currentInvoice.bookingId } })
          : null;
        const unavailableReason = nativePaymentUnavailableReason(currentInvoice, booking);
        return {
          ...result(current.status),
          canCreatePayment: !unavailableReason,
          ...(unavailableReason ? { unavailableReason } : {}),
        };
      }
      throw error;
    }
    if (
      fetched.id !== payment.gatewayRef ||
      fetched.amount !== Number(payment.amount) ||
      fetched.currency.toUpperCase() !== payment.currency.toUpperCase() ||
      (fetched.metadata?.invoiceId &&
        fetched.metadata.invoiceId !== payment.invoiceId)
    ) {
      throw new ConflictException(
        "Provider payment does not match reserved attempt",
      );
    }
    const applied = await this.settlement.execute({
      invoiceId: payment.invoiceId,
      gatewayPaymentId: payment.gatewayRef,
      gatewayRefs: [payment.gatewayRef],
      fetched,
      requiredPaymentId: payment.id,
    });
    if (
      [
        "identity_mismatch",
        "amount_mismatch",
        "currency_mismatch",
        "invoice_not_found",
        "payment_not_found",
      ].includes(applied.reason ?? "")
    )
      throw new ConflictException("Payment no longer matches its invoice");
    const current = await this.prisma.payment.findUnique({
      where: { id: payment.id },
    });
    if (!current)
      throw new ConflictException("Payment changed during reconciliation");
    const review = await this.prisma.refundRequest.findFirst({
      where: { paymentId: payment.id, status: "PENDING_REVIEW" },
      select: { id: true },
    });
    return result(current.status, applied.requiresReview || !!review);
  }
}
