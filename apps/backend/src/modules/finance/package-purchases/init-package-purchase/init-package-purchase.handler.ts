import { createHash, randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  InvoiceStatus,
  PackagePurchaseStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import {
  PrismaService,
  RlsTransactionService,
} from "../../../../infrastructure/database";
import { ComputePackagePriceService } from "../../../org-experience/compute-package-price.service";
import { MoyasarApiClient } from "../../moyasar-api/moyasar-api.client";
import { DEFAULT_ORG_ID } from "../../../../common/constants";
import { InitPackagePurchaseDto } from "./init-package-purchase.dto";
import {
  createPackageCreditSnapshot,
  parsePackageCreditSnapshot,
  type PackageCreditSnapshotItem,
} from "../package-credit-snapshot";

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

export function selfPurchaseFingerprint(
  cmd: InitPackagePurchaseCommand,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        source: "self-purchase",
        clientId: cmd.clientId,
        packageId: cmd.packageId,
        branchId: cmd.branchId,
      }),
    )
    .digest("hex");
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

  async execute(
    cmd: InitPackagePurchaseCommand,
  ): Promise<InitPackagePurchaseResult> {
    const requestFingerprint = selfPurchaseFingerprint(cmd);
    const keyedPurchase = await this.prisma.packagePurchase.findUnique({
      where: { idempotencyKey: cmd.idempotencyKey },
      select: {
        id: true,
        requestFingerprint: true,
        status: true,
        subtotalSnapshot: true,
        discountSnapshot: true,
        amountPaid: true,
        creditSnapshot: true,
      },
    });
    if (keyedPurchase) {
      if (keyedPurchase.requestFingerprint !== requestFingerprint) {
        throw new ConflictException(
          "Package purchase idempotency key was already used with a different request",
        );
      }
      if (keyedPurchase.status !== PackagePurchaseStatus.PENDING) {
        throw new BadRequestException("This purchase has already been paid");
      }
    }

    let packageNameAr = "باقة جلسات";
    let price: {
      subtotal: number;
      discountAmount: number;
      finalPrice: number;
      itemUnitPrices: { unitPrice: number }[];
    };
    let creditSnapshot: PackageCreditSnapshotItem[];

    if (keyedPurchase) {
      // A retry of an existing checkout must use the originally frozen money
      // and credits even if staff edited, hid, or archived the package later.
      const persistedSnapshot = parsePackageCreditSnapshot(
        keyedPurchase.creditSnapshot,
      );
      if (!persistedSnapshot) {
        throw new ConflictException(
          "Pending package purchase is missing its credit snapshot",
        );
      }
      price = {
        subtotal: Number(keyedPurchase.subtotalSnapshot),
        discountAmount: Number(keyedPurchase.discountSnapshot),
        finalPrice: Number(keyedPurchase.amountPaid),
        itemUnitPrices: persistedSnapshot.map((item) => ({
          unitPrice: item.unitPriceSnapshot,
        })),
      };
      creditSnapshot = persistedSnapshot;
    } else {
      // 1. Load the package — only a public, active, non-archived package is
      // self-purchasable. Same gate as the public catalog.
      const pkg = await this.prisma.sessionPackage.findFirst({
        where: {
          id: cmd.packageId,
          isPublic: true,
          isActive: true,
          archivedAt: null,
        },
        include: {
          items: {
            orderBy: { sortOrder: "asc" },
            include: { constraints: { include: { targets: true } } },
          },
        },
      });
      if (!pkg) {
        throw new NotFoundException("Session package not found");
      }
      packageNameAr = pkg.nameAr;

      // 2. Verify the client exists (cross-BC — no FK).
      const client = await this.prisma.client.findFirst({
        where: { id: cmd.clientId },
        select: { id: true },
      });
      if (!client) {
        throw new NotFoundException("Client not found");
      }

      // 3. Freeze the price with the SAME service the catalog + reception sale use.
      price = await this.pricing.compute({
        items: pkg.items.map((it) => ({
          serviceId: it.serviceId,
          employeeId: it.employeeId,
          durationOptionId: it.durationOptionId,
          unitPrice: it.unitPrice != null ? Number(it.unitPrice) : null,
          paidQuantity: it.paidQuantity,
          freeQuantity: it.freeQuantity,
          discountType: it.discountType,
          discountValue: Number(it.discountValue),
        })),
      });
      if (price.finalPrice < 100) {
        throw new BadRequestException(
          "This package cannot be purchased online (price below the gateway minimum)",
        );
      }
      creditSnapshot = createPackageCreditSnapshot(
        pkg.items,
        price.itemUnitPrices,
      );
    }

    // 4 + 5 + 6 — materialize (or reuse) the PENDING purchase + invoice + payment.
    const { purchaseId, invoiceId, paymentId, amountHalalas, givenId } =
      await this.materializePending(
        cmd,
        price,
        creditSnapshot,
        requestFingerprint,
      );

    // 7. The attempt's given_id was persisted on Payment before this external
    // call. An unknown outcome can therefore be reconciled and retried with the
    // same gateway-idempotent identity instead of creating a second charge.
    let moyasarPayment: Awaited<ReturnType<MoyasarApiClient["createPayment"]>>;
    try {
      moyasarPayment = await this.moyasar.createPayment(DEFAULT_ORG_ID, {
        amountHalalas,
        currency: "SAR",
        description: `Package purchase - ${packageNameAr}`,
        callbackUrl: this.buildCallbackUrl(purchaseId, invoiceId),
        metadata: {
          invoiceId,
          packagePurchaseId: purchaseId,
          source: "self-purchase",
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
      throw new BadRequestException(
        "Payment gateway did not return a redirect URL",
      );
    }

    if (moyasarPayment.id !== givenId) {
      throw new ConflictException(
        "Payment gateway returned a different attempt identity",
      );
    }

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
    creditSnapshot: ReturnType<typeof createPackageCreditSnapshot>,
    requestFingerprint: string,
  ): Promise<{
    purchaseId: string;
    invoiceId: string;
    paymentId: string;
    amountHalalas: number;
    givenId: string;
  }> {
    // Reuse an in-flight PENDING purchase for the same (client, package) whose
    // payment has not completed. We re-issue a fresh charge against its existing
    // invoice rather than creating duplicate PENDING rows on every retry.
    const existing = await this.prisma.packagePurchase.findFirst({
      where: {
        clientId: cmd.clientId,
        packageId: cmd.packageId,
        status: PackagePurchaseStatus.PENDING,
        // Rows created before checkout idempotency have no key, fingerprint, or
        // credit snapshot. Keep them as immutable audit history, but do not let
        // an abandoned legacy row permanently block a modern keyed checkout.
        idempotencyKey: { not: null },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, idempotencyKey: true, requestFingerprint: true },
    });
    if (existing) {
      if (
        existing.idempotencyKey !== cmd.idempotencyKey ||
        existing.requestFingerprint !== requestFingerprint
      ) {
        throw new ConflictException(
          "Another checkout is already pending for this client and package",
        );
      }
      const invoice = await this.prisma.invoice.findFirst({
        where: { packagePurchaseId: existing.id },
        select: { id: true, total: true, status: true },
      });
      if (invoice) {
        if (
          invoice.status === InvoiceStatus.PAID ||
          invoice.status === InvoiceStatus.PARTIALLY_REFUNDED ||
          invoice.status === InvoiceStatus.REFUNDED
        ) {
          throw new BadRequestException("This purchase has already been paid");
        }
        const idempotencyKey = `client-pkg:${invoice.id}`;
        let payment = await this.prisma.payment.findFirst({
          where: { idempotencyKey },
          select: { id: true, status: true, gatewayRef: true },
        });
        if (!payment) {
          // MoyasarWebhook replaces the checkout idempotency key with its
          // provider identity before async package activation. Find the settled
          // invoice payment directly so that window cannot mint a second link.
          payment = await this.prisma.payment.findFirst({
            where: { invoiceId: invoice.id, status: PaymentStatus.COMPLETED },
            orderBy: { processedAt: "desc" },
            select: { id: true, status: true, gatewayRef: true },
          });
        }
        // A completed payment means this purchase should already be (or is being)
        // activated — do not re-charge. Treat it as a conflict-free no-op error.
        if (payment?.status === PaymentStatus.COMPLETED) {
          throw new BadRequestException("This purchase has already been paid");
        }
        if (payment) {
          if (payment.status === PaymentStatus.PENDING && !payment.gatewayRef) {
            throw new ConflictException(
              "Package payment initialization is already in progress",
            );
          }
          if (payment.gatewayRef) {
            const shouldReuse = await this.shouldReuseGatewayAttempt({
              id: payment.id,
              gatewayRef: payment.gatewayRef,
            });
            if (shouldReuse) {
              return {
                purchaseId: existing.id,
                invoiceId: invoice.id,
                paymentId: payment.id,
                amountHalalas: Number(invoice.total),
                givenId: payment.gatewayRef,
              };
            }
          }
          // Only a provider-confirmed terminal failure (or a legacy FAILED row
          // without an identity) reaches here, so replacing it is safe.
          await this.prisma.payment.delete({ where: { id: payment.id } });
        }
        const amountHalalas = Number(invoice.total);
        const givenId = randomUUID();
        const fresh = await this.prisma.payment.create({
          data: {
            invoiceId: invoice.id,
            amount: new Prisma.Decimal(amountHalalas),
            currency: "SAR",
            method: PaymentMethod.ONLINE_CARD,
            status: PaymentStatus.PENDING,
            idempotencyKey,
            gatewayRef: givenId,
          },
          select: { id: true },
        });
        return {
          purchaseId: existing.id,
          invoiceId: invoice.id,
          paymentId: fresh.id,
          amountHalalas,
          givenId,
        };
      }
    }

    try {
      return await this.rlsTransaction.withTransaction(async (tx) => {
        const purchase = await tx.packagePurchase.create({
          data: {
            idempotencyKey: cmd.idempotencyKey,
            requestFingerprint,
            creditSnapshot: creditSnapshot as unknown as Prisma.InputJsonValue,
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
            employeeId: "",
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
            status: "DRAFT",
          },
          select: { id: true },
        });

        const givenId = randomUUID();
        const payment = await tx.payment.create({
          data: {
            invoiceId: invoice.id,
            amount: new Prisma.Decimal(price.finalPrice),
            currency: "SAR",
            method: PaymentMethod.ONLINE_CARD,
            status: PaymentStatus.PENDING,
            idempotencyKey: `client-pkg:${invoice.id}`,
            gatewayRef: givenId,
          },
          select: { id: true },
        });

        return {
          purchaseId: purchase.id,
          invoiceId: invoice.id,
          paymentId: payment.id,
          amountHalalas: price.finalPrice,
          givenId,
        };
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      ) {
        throw error;
      }

      // A same-key concurrent request may have committed while this transaction
      // waited on either uniqueness constraint. Re-enter the reuse path only if
      // that exact canonical request won; otherwise the pair-level pending guard
      // is a real conflict and must never initialize a second gateway session.
      const winner = await this.prisma.packagePurchase.findUnique({
        where: { idempotencyKey: cmd.idempotencyKey },
        select: { requestFingerprint: true },
      });
      if (!winner || winner.requestFingerprint !== requestFingerprint) {
        throw new ConflictException(
          "Another checkout is already pending for this client and package",
        );
      }
      return this.materializePending(
        cmd,
        price,
        creditSnapshot,
        requestFingerprint,
      );
    }
  }

  private buildCallbackUrl(purchaseId: string, invoiceId: string): string {
    const baseUrl =
      process.env["PUBLIC_WEBSITE_URL"] || "http://localhost:3000";
    return `${baseUrl}/packages/payment-callback?purchaseId=${purchaseId}&invoiceId=${invoiceId}`;
  }

  private async shouldReuseGatewayAttempt(payment: {
    id: string;
    gatewayRef: string;
  }): Promise<boolean> {
    try {
      const gateway = await this.moyasar.getPaymentStatus(
        DEFAULT_ORG_ID,
        payment.gatewayRef,
      );
      if (["paid", "captured", "authorized"].includes(gateway.status)) {
        throw new ConflictException("This purchase has already been paid");
      }
      // Re-POSTing an initiated attempt with the same given_id returns the
      // exact provider payment and restores its redirect idempotently.
      return gateway.status === "initiated";
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (error instanceof NotFoundException) {
        // The provider authoritatively confirmed this durable identity does not
        // exist. Creating it with the same given_id remains the same attempt.
        return true;
      }
      if (error instanceof Error) {
        this.logger.error(
          `Failed to reconcile package payment attempt ${payment.id}`,
          error.stack,
        );
      }
      throw new ConflictException(
        "تعذّر التحقق من حالة الدفعة الجارية، حاول مرة أخرى لاحقاً",
      );
    }
  }
}
