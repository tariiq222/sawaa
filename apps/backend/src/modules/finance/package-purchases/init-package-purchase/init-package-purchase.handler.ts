import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  PackagePurchaseStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { ComputePackagePriceService } from '../../../org-experience/compute-package-price.service';
import { MoyasarApiClient } from '../../moyasar-api/moyasar-api.client';
import { DEFAULT_ORG_ID } from '../../../../common/constants';
import { InitPackagePurchaseDto } from './init-package-purchase.dto';
import { reconcileOrDiscardInFlightPayment } from '../../payments/client/init-client-payment/reconcile-in-flight-payment.helper';

export type InitPackagePurchaseCommand = InitPackagePurchaseDto & {
  /** Authenticated client id (set by the controller from the client session). */
  clientId: string;
};

export interface InitPackagePurchaseResult {
  purchaseId: string;
  invoiceId: string;
  paymentId: string;
  redirectUrl: string;
}

/**
 * Self-purchase of a SessionPackage by an authenticated CLIENT (website/mobile),
 * paid online via Moyasar. Phase 4 of the session-packages rebuild.
 *
 * This is the online counterpart to the reception manual sale
 * (CreatePackagePurchaseHandler). It REUSES the existing client-payment Moyasar
 * infrastructure rather than reinventing it:
 *   - the price is frozen with the SAME ComputePackagePriceService;
 *   - the Moyasar charge is created with the SAME MoyasarApiClient.createPayment
 *     contract used by InitClientPaymentHandler (amount in halalas, fresh
 *     `given_id` UUID per attempt, metadata.invoiceId so the UNCHANGED webhook
 *     can resolve the invoice);
 *   - on a successful webhook the EXISTING MoyasarWebhookHandler emits
 *     PaymentCompletedEvent carrying `invoice.packagePurchaseId`, which the
 *     ActivatePackagePurchaseHandler consumes to flip the purchase ACTIVE and
 *     issue the credit buckets.
 *
 * Pipeline (one transaction so the purchase, invoice, and PENDING payment are
 * created atomically):
 *   1. Load the package; reject unless public + active + non-archived (same
 *      surface the public catalog exposes — a client cannot buy a private one).
 *   2. Verify the client exists.
 *   3. Freeze the price (subtotal / discount / final). Reject a zero-price
 *      package — Moyasar's minimum charge is 100 halalas.
 *   4. Idempotency: an in-flight PENDING purchase for the same (client, package)
 *      with a still-PENDING payment is reused; we re-issue a fresh Moyasar charge
 *      against its existing invoice (mirrors InitClientPaymentHandler, which
 *      deletes-and-recreates the non-completed payment). A purchase that has
 *      already gone ACTIVE is never reused — multiple purchases of the same
 *      package are allowed (the plan's "التعدد" decision).
 *   5. Create PackagePurchase(status=PENDING) — NO credits yet: a PENDING
 *      purchase is excluded from every consumption path, so nothing is bookable
 *      before payment. Credits are issued only on activation.
 *   6. Create the Invoice linked via `packagePurchaseId` (status=DRAFT, VAT=0)
 *      and a PENDING Payment row keyed by `idempotencyKey = client-pkg:<invoice>`.
 *   7. Drive Moyasar and return the redirect URL.
 *
 * Failure / abandon path: the purchase stays PENDING with no credits, the
 * invoice stays DRAFT, the payment stays PENDING/FAILED — no credit is ever
 * issued. This requires NO change to the webhook: the webhook only emits
 * PaymentCompletedEvent on `paid`, and the activation consumer is the sole
 * issuer of credits.
 */
@Injectable()
export class InitPackagePurchaseHandler {
  private readonly logger = new Logger(InitPackagePurchaseHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly pricing: ComputePackagePriceService,
    private readonly moyasar: MoyasarApiClient,
  ) {}

  async execute(cmd: InitPackagePurchaseCommand): Promise<InitPackagePurchaseResult> {
    // 1. Load the package — only a public, active, non-archived package is
    // self-purchasable. Same gate as the public catalog so a client cannot buy
    // a hidden/admin package by guessing its id.
    const pkg = await this.prisma.sessionPackage.findFirst({
      where: {
        id: cmd.packageId,
        isPublic: true,
        isActive: true,
        archivedAt: null,
      },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!pkg) {
      throw new NotFoundException('Session package not found');
    }

    // 2. Verify the client exists (cross-BC — no FK).
    const client = await this.prisma.client.findFirst({
      where: { id: cmd.clientId },
      select: { id: true },
    });
    if (!client) {
      throw new NotFoundException('Client not found');
    }

    // 3. Freeze the price with the SAME service the catalog + reception sale use.
    //    Discount now lives per-item; subtotal/discount/finalPrice keep their meaning.
    const price = await this.pricing.compute({
      items: pkg.items.map((it) => ({
        serviceId: it.serviceId,
        employeeId: it.employeeId,
        durationOptionId: it.durationOptionId,
        paidQuantity: it.paidQuantity,
        freeQuantity: it.freeQuantity,
        discountType: it.discountType,
        discountValue: Number(it.discountValue),
      })),
    });

    // Moyasar's minimum charge is 100 halalas (1.00 SAR). A free package cannot
    // be sold through the online path — it would have to be granted manually.
    if (price.finalPrice < 100) {
      throw new BadRequestException(
        'This package cannot be purchased online (price below the gateway minimum)',
      );
    }

    // 4 + 5 + 6 — materialize (or reuse) the PENDING purchase + invoice + payment.
    const { purchaseId, invoiceId, paymentId } = await this.materializePending(cmd, price);

    // 7. Drive Moyasar. Fresh given_id per attempt (mirrors InitClientPayment) —
    // keying on the invoice alone would pin the first amount and the gateway
    // would reject a changed amount on a retry.
    const givenId = randomUUID();
    let moyasarPayment: Awaited<ReturnType<MoyasarApiClient['createPayment']>>;
    try {
      moyasarPayment = await this.moyasar.createPayment(DEFAULT_ORG_ID, {
        amountHalalas: price.finalPrice,
        currency: 'SAR',
        description: `Package purchase - ${pkg.nameAr}`,
        callbackUrl: this.buildCallbackUrl(purchaseId, invoiceId),
        metadata: {
          invoiceId,
          packagePurchaseId: purchaseId,
          source: 'self-purchase',
        },
        givenId,
      });
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Moyasar payment creation failed for package purchase ${purchaseId}`,
          error.stack,
        );
      }
      throw error;
    }

    const redirectUrl = moyasarPayment.redirectUrl;
    if (!redirectUrl) {
      throw new BadRequestException('Payment gateway did not return a redirect URL');
    }

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { gatewayRef: moyasarPayment.id },
    });

    return { purchaseId, invoiceId, paymentId, redirectUrl };
  }

  /**
   * Create the PENDING purchase + invoice + PENDING payment, or reuse an
   * in-flight one. NO credits are created here — credits are issued only when the
   * activation consumer flips the purchase to ACTIVE on a successful webhook.
   */
  private async materializePending(
    cmd: InitPackagePurchaseCommand,
    price: { subtotal: number; discountAmount: number; finalPrice: number },
  ): Promise<{ purchaseId: string; invoiceId: string; paymentId: string }> {
    // Reuse an in-flight PENDING purchase for the same (client, package) whose
    // payment has not completed. We re-issue a fresh charge against its existing
    // invoice rather than creating duplicate PENDING rows on every retry.
    const existing = await this.prisma.packagePurchase.findFirst({
      where: {
        clientId: cmd.clientId,
        packageId: cmd.packageId,
        status: PackagePurchaseStatus.PENDING,
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (existing) {
      const invoice = await this.prisma.invoice.findFirst({
        where: { packagePurchaseId: existing.id },
        select: { id: true },
      });
      if (invoice) {
        const idempotencyKey = `client-pkg:${invoice.id}`;
        const payment = await this.prisma.payment.findFirst({
          where: { idempotencyKey },
          select: { id: true, status: true, gatewayRef: true },
        });
        // A completed payment means this purchase should already be (or is being)
        // activated — do not re-charge. Treat it as a conflict-free no-op error.
        if (payment?.status === PaymentStatus.COMPLETED) {
          throw new BadRequestException('This purchase has already been paid');
        }
        if (payment) {
          // P1-6 (G3): reconcile the in-flight session against the gateway before
          // discarding it, then delete so a fresh PENDING payment can be created
          // below. Shared verbatim with InitClientPaymentHandler to prevent drift
          // (a drift = double charge).
          await reconcileOrDiscardInFlightPayment(
            this.prisma,
            this.moyasar,
            this.logger,
            payment,
            {
              alreadyPaid: 'This purchase has already been paid',
              inFlight:
                'هناك دفعة قيد التنفيذ لهذه الباقة، أكمل الدفع الحالي أو انتظر انتهاء الجلسة',
            },
          );
        }
        const fresh = await this.prisma.payment.create({
          data: {
            invoiceId: invoice.id,
            amount: new Prisma.Decimal(price.finalPrice),
            currency: 'SAR',
            method: PaymentMethod.ONLINE_CARD,
            status: PaymentStatus.PENDING,
            idempotencyKey,
          },
          select: { id: true },
        });
        return { purchaseId: existing.id, invoiceId: invoice.id, paymentId: fresh.id };
      }
    }

    return this.rlsTransaction.withTransaction(async (tx) => {
      const purchase = await tx.packagePurchase.create({
        data: {
          packageId: cmd.packageId,
          clientId: cmd.clientId,
          branchId: cmd.branchId,
          // PENDING — not consumable until the Moyasar webhook activates it.
          status: PackagePurchaseStatus.PENDING,
          subtotalSnapshot: new Prisma.Decimal(price.subtotal),
          discountSnapshot: new Prisma.Decimal(price.discountAmount),
          amountPaid: new Prisma.Decimal(price.finalPrice),
          // paidAt is required by the schema; it is overwritten with the real
          // settlement time on activation. Stamp init time as a placeholder.
          paidAt: new Date(),
        },
        select: { id: true },
      });

      const invoice = await tx.invoice.create({
        data: {
          branchId: cmd.branchId,
          clientId: cmd.clientId,
          employeeId: '',
          bookingId: null,
          packagePurchaseId: purchase.id,
          subtotal: new Prisma.Decimal(price.subtotal),
          discountAmt: new Prisma.Decimal(price.discountAmount),
          // VAT = 0 — the center is not VAT-registered (CLAUDE.md).
          vatRate: new Prisma.Decimal(0),
          vatAmt: new Prisma.Decimal(0),
          total: new Prisma.Decimal(price.finalPrice),
          // DRAFT ("awaiting payment") until the Moyasar webhook confirms the
          // first COMPLETED payment, which stamps issuedAt and flips it to PAID.
          status: 'DRAFT',
        },
        select: { id: true },
      });

      const payment = await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: new Prisma.Decimal(price.finalPrice),
          currency: 'SAR',
          method: PaymentMethod.ONLINE_CARD,
          status: PaymentStatus.PENDING,
          idempotencyKey: `client-pkg:${invoice.id}`,
        },
        select: { id: true },
      });

      return { purchaseId: purchase.id, invoiceId: invoice.id, paymentId: payment.id };
    });
  }

  private buildCallbackUrl(purchaseId: string, invoiceId: string): string {
    const baseUrl = process.env['PUBLIC_WEBSITE_URL'] || 'http://localhost:3000';
    return `${baseUrl}/packages/payment-callback?purchaseId=${purchaseId}&invoiceId=${invoiceId}`;
  }
}
