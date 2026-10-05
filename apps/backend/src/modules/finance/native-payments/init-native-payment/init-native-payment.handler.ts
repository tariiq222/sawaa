import { nativePaymentUnavailableReason } from "../native-payment-eligibility";
import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PaymentStatus, Prisma } from "@prisma/client";
import type {
  NativePaymentInitResponse,
  NativePaymentMethod,
} from "@sawaa/shared/types";
import {
  PrismaService,
  RlsTransactionService,
} from "../../../../infrastructure/database";
import { GetNativePaymentConfigHandler } from "../get-native-payment-config/get-native-payment-config.handler";
import { ReconcileNativePaymentHandler } from "../reconcile-native-payment/reconcile-native-payment.handler";
import { nativePaymentConfigFingerprint } from "../native-payment-config-fingerprint";
import { MoyasarApiClient } from "../../moyasar-api/moyasar-api.client";
import { DEFAULT_ORG_ID } from "../../../../common/constants";

export interface InitNativePaymentCommand {
  clientId: string;
  invoiceId: string;
  method?: NativePaymentMethod;
}
const conflict = (
  code: string,
  message: string,
  identity: { paymentId?: string; invoiceId?: string } = {},
) => new ConflictException({ code, message, ...identity });
@Injectable()
export class InitNativePaymentHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: RlsTransactionService,
    private readonly configurations: GetNativePaymentConfigHandler,
    private readonly reconcile: ReconcileNativePaymentHandler,
    private readonly moyasar: MoyasarApiClient,
  ) {}
  async execute(
    cmd: InitNativePaymentCommand,
  ): Promise<NativePaymentInitResponse> {
    const visible = await this.prisma.invoice.findFirst({
      where: { id: cmd.invoiceId },
    });
    if (!visible) throw new NotFoundException("Invoice not found");
    if (visible.clientId !== cmd.clientId)
      throw new ForbiddenException("Invoice does not belong to this client");
    const config = await this.configurations.getPaymentConfiguration();
    if (cmd.method === "APPLE_PAY" && !config.applePay)
      throw new BadRequestException("Apple Pay is not configured");
    const fingerprint = nativePaymentConfigFingerprint(config);
    const reserve = async (replace?: {
      id: string;
      status: PaymentStatus;
      gatewayRef: string | null;
    }) =>
      this.transactions.withTransaction(async (tx) => {
        if (visible.bookingId)
          await tx.$queryRaw(
            Prisma.sql`SELECT "id" FROM "Booking" WHERE "id" = ${visible.bookingId} FOR UPDATE`,
          );
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "Invoice" WHERE "id" = ${cmd.invoiceId} FOR UPDATE`,
        );
        const invoice = await tx.invoice.findFirst({
          where: { id: cmd.invoiceId },
        });
        if (!invoice || invoice.clientId !== cmd.clientId)
          throw new ForbiddenException(
            "Invoice does not belong to this client",
          );
        if (invoice.status === "PAID") {
          const completed = await tx.payment.findFirst({
            where: {
              invoiceId: invoice.id,
              status: PaymentStatus.COMPLETED,
              nativeConfigFingerprint: { not: null },
            },
            orderBy: { processedAt: "desc" },
            select: { id: true, gatewayRef: true },
          });
          throw conflict(
            "PAYMENT_ALREADY_COMPLETED",
            "Invoice is already paid",
            {
              invoiceId: invoice.id,
              ...(completed?.gatewayRef === completed?.id && completed
                ? { paymentId: completed.id }
                : {}),
            },
          );
        }
        const booking = invoice.bookingId
          ? await tx.booking.findFirst({ where: { id: invoice.bookingId } })
          : null;
        const unavailableReason = nativePaymentUnavailableReason(invoice, booking);
        if (unavailableReason)
          throw new BadRequestException({
            code: unavailableReason,
            message: unavailableReason === "BOOKING_EXPIRED"
              ? "Booking hold has expired"
              : "Payment target is not payable",
          });
        const paid = await tx.payment.aggregate({
          where: { invoiceId: invoice.id, status: PaymentStatus.COMPLETED },
          _sum: { amount: true },
        });
        const outstanding =
          Number(invoice.total) - Number(paid._sum.amount ?? 0);
        if (!Number.isSafeInteger(outstanding) || outstanding < 100)
          throw new BadRequestException(
            "Invoice amount is below the payment minimum or invalid",
          );
        if (replace) {
          const current = await tx.payment.findUnique({
            where: { id: replace.id },
          });
          if (
            !current ||
            current.status !== replace.status ||
            current.gatewayRef !== replace.gatewayRef
          )
            throw new ConflictException(
              "Payment changed during reconciliation",
            );
          // Retain provider identity and money history; only release the retry key.
          await tx.payment.update({
            where: { id: replace.id },
            data: { status: PaymentStatus.FAILED, idempotencyKey: null },
          });
        }
        const payment = await tx.payment.findFirst({
          where: {
            invoiceId: invoice.id,
            OR: [
              {
                status: {
                  in: [
                    PaymentStatus.PENDING,
                    PaymentStatus.PENDING_VERIFICATION,
                  ],
                },
              },
              {
                idempotencyKey: {
                  in: [`native:${invoice.id}`, `client-pkg:${invoice.id}`],
                },
              },
            ],
          },
          orderBy: { createdAt: "desc" },
        });
        if (payment) {
          // Another initializer may win while provider reconciliation runs.
          // Never expose its row as a replacement: repeat through a fresh init.
          if (replace)
            throw conflict(
              payment.gatewayRef === payment.id
                ? "NATIVE_PAYMENT_IN_PROGRESS"
                : "HOSTED_PAYMENT_IN_PROGRESS",
              "Another payment reserved this invoice during reconciliation",
            );
          return { invoice, payment, existing: true };
        }
        const id = randomUUID();
        const created = await tx.payment.create({
          data: {
            id,
            invoiceId: invoice.id,
            amount: outstanding,
            currency: invoice.currency,
            method: "ONLINE_CARD",
            status: PaymentStatus.PENDING,
            gatewayRef: id,
            idempotencyKey: invoice.packagePurchaseId
              ? `client-pkg:${invoice.id}`
              : `native:${invoice.id}`,
            nativeConfigFingerprint: fingerprint,
          },
        });
        return { invoice, payment: created, existing: false };
      });
    let reserved = await reserve();
    if (reserved.existing) {
      const payment = reserved.payment;
      if (payment.gatewayRef !== payment.id) {
        // Unknown hosted creation and bank transfer reservations stay protected.
        if (payment.status === PaymentStatus.PENDING && payment.gatewayRef) {
          let hosted;
          try {
            hosted = await this.moyasar.getCheckoutInvoice(
              DEFAULT_ORG_ID,
              payment.gatewayRef,
            );
          } catch (error) {
            if (!(error instanceof NotFoundException)) throw error;
          }
          if (
            hosted &&
            ["expired", "failed", "canceled", "voided"].includes(hosted.status)
          ) {
            if (
              hosted.amount !== Number(payment.amount) ||
              hosted.currency !== payment.currency
            )
              throw new ConflictException(
                "Hosted invoice does not match reservation",
              );
            reserved = await reserve(payment);
          } else
            throw conflict(
              "HOSTED_PAYMENT_IN_PROGRESS",
              "An existing hosted payment is in progress",
            );
        } else
          throw conflict(
            "HOSTED_PAYMENT_IN_PROGRESS",
            "Another payment is pending completion or verification",
          );
      } else {
        if (payment.nativeConfigFingerprint !== fingerprint)
          throw conflict(
            "PAYMENT_CONFIGURATION_CHANGED",
            "Payment configuration changed; existing attempt needs review",
          );
        if (
          Number(payment.amount) !==
            Number(reserved.invoice.total) -
              Number(
                (
                  await this.prisma.payment.aggregate({
                    where: {
                      invoiceId: cmd.invoiceId,
                      status: PaymentStatus.COMPLETED,
                    },
                    _sum: { amount: true },
                  })
                )._sum.amount ?? 0,
              ) ||
          payment.currency !== reserved.invoice.currency
        )
          throw new ConflictException(
            "Reserved amount no longer matches invoice",
          );
        const reconciled = await this.reconcile.execute({
          clientId: cmd.clientId,
          paymentId: payment.id,
        });
        if (
          reconciled.status === "COMPLETED" ||
          reconciled.status === "PARTIALLY_REFUNDED" ||
          reconciled.status === "REFUNDED" ||
          reconciled.requiresReview
        )
          throw conflict(
            "PAYMENT_ALREADY_COMPLETED",
            "Payment has already completed; refresh its status",
            { paymentId: payment.id, invoiceId: reserved.invoice.id },
          );
        if (reconciled.status === "FAILED")
          reserved = await reserve({
            ...payment,
            status: PaymentStatus.FAILED,
          });
        else if (reconciled.canCreatePayment !== true)
          throw conflict(
            "NATIVE_PAYMENT_IN_PROGRESS",
            "Resume or reconcile the existing provider payment",
            { paymentId: payment.id, invoiceId: reserved.invoice.id },
          );
      }
    }
    // Every return path must expose only an atomically bound native attempt.
    if (
      reserved.payment.gatewayRef !== reserved.payment.id ||
      reserved.payment.status !== PaymentStatus.PENDING
    ) {
      throw conflict(
        "HOSTED_PAYMENT_IN_PROGRESS",
        "Payment is not a payable native reservation",
      );
    }
    if (reserved.payment.nativeConfigFingerprint !== fingerprint) {
      throw conflict(
        "PAYMENT_CONFIGURATION_CHANGED",
        "Payment configuration changed; existing attempt needs review",
      );
    }
    return {
      paymentId: reserved.payment.id,
      invoiceId: reserved.invoice.id,
      config: {
        ...config,
        givenId: reserved.payment.id,
        amount: Number(reserved.payment.amount),
        currency: reserved.payment.currency,
        description: `Invoice payment - ${reserved.invoice.id}`,
      },
    };
  }
}
