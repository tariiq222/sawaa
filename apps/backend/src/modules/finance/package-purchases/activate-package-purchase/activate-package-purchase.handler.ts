import { Injectable, Logger } from '@nestjs/common';
import { PackagePurchaseStatus, Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { EventBusService, type DomainEventEnvelope } from '../../../../infrastructure/events';
import { DEFAULT_ORG_ID, SYSTEM_CONTEXT_CLS_KEY, TENANT_CLS_KEY } from '../../../../common/constants';
import { ComputePackagePriceService } from '../../../org-experience/compute-package-price.service';
import type { PaymentCompletedPayload } from '../../events/payment-completed.event';

/**
 * Activates a self-purchased session package when its Moyasar payment completes.
 *
 * Subscribes to `finance.payment.completed`. The EXISTING (unchanged) Moyasar
 * webhook emits this event with `invoice.packagePurchaseId` set for package
 * invoices. This consumer is the SOLE issuer of credits for the online path:
 *   - flips the PENDING purchase to ACTIVE (the only status BookFromCredit /
 *     GetMatchingCredits accept — so the credit becomes bookable here and not a
 *     moment earlier);
 *   - creates one PackageCredit bucket per SessionPackageItem with
 *     `totalQuantity = paidQuantity + freeQuantity` and the per-item unit price
 *     re-frozen from the SAME ComputePackagePriceService.
 *
 * Idempotency (the webhook is at-least-once and Moyasar retries):
 *   - We only act on a purchase whose status is PENDING. The flip
 *     PENDING -> ACTIVE is done with `updateMany({ where: { status: PENDING } })`
 *     so a concurrent/duplicate delivery sees `count = 0` and bails BEFORE
 *     creating any credits. This makes double-issuance impossible even under a
 *     race, on top of the webhook's own WebhookEvent dedup.
 *   - A purchase already ACTIVE / COMPLETED / REFUNDED is left untouched.
 *
 * This adds NO change to the Moyasar webhook or to booking-payment semantics — it
 * is a pure additive cross-slice reaction to an event the finance cluster already
 * publishes.
 */
@Injectable()
export class ActivatePackagePurchaseHandler {
  private readonly logger = new Logger(ActivatePackagePurchaseHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly eventBus: EventBusService,
    private readonly cls: ClsService,
    private readonly pricing: ComputePackagePriceService,
  ) {}

  register(): void {
    this.eventBus.subscribe<PaymentCompletedPayload>(
      'finance.payment.completed',
      (envelope: DomainEventEnvelope<PaymentCompletedPayload>) => this.handle(envelope),
    );
  }

  async handle(envelope: DomainEventEnvelope<PaymentCompletedPayload>): Promise<void> {
    const { packagePurchaseId, paymentId } = envelope.payload;
    // Only package-purchase invoices carry a packagePurchaseId — booking
    // invoices have none and are handled by the bookings consumer. Skip silently.
    if (!packagePurchaseId) {
      return;
    }

    try {
      // Read the purchase in system context (BullMQ worker — no inherited CLS).
      const purchase = await this.cls.run(async () => {
        this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
        return this.prisma.packagePurchase.findFirst({
          where: { id: packagePurchaseId },
          select: {
            id: true,
            packageId: true,
            status: true,
            subtotalSnapshot: true,
            discountSnapshot: true,
          },
        });
      });

      if (!purchase) {
        this.logger.warn(
          `Payment ${paymentId} completed for unknown package purchase ${packagePurchaseId} — skipping`,
        );
        return;
      }

      // Idempotency: only a PENDING purchase is activated. A duplicate delivery,
      // or a purchase already ACTIVE/COMPLETED/REFUNDED, is a no-op.
      if (purchase.status !== PackagePurchaseStatus.PENDING) {
        this.logger.log(
          `Package purchase ${packagePurchaseId} is ${purchase.status} (not PENDING) — activation skipped (idempotent)`,
        );
        return;
      }

      // Load the package items so we can build the credit buckets. The items are
      // a definition (not per-purchase rows); read them in system context too.
      const pkg = await this.cls.run(async () => {
        this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
        return this.prisma.sessionPackage.findFirst({
          where: { id: purchase.packageId },
          select: {
            items: {
              orderBy: { sortOrder: 'asc' },
              select: {
                serviceId: true,
                employeeId: true,
                durationOptionId: true,
                paidQuantity: true,
                freeQuantity: true,
                discountType: true,
                discountValue: true,
              },
            },
          },
        });
      });

      if (!pkg) {
        this.logger.error(
          `Package ${purchase.packageId} for purchase ${packagePurchaseId} not found — cannot issue credits`,
        );
        return;
      }

      // Re-freeze the per-item unit prices. The purchase already stores the
      // subtotal/discount snapshot; we only need the per-item unitPrice to stamp
      // on each credit bucket, so the FIFO consumption logic has the right number.
      const price = await this.cls.run(async () => {
        this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
        return this.pricing.compute({
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
      });

      const unitPriceByDuration = new Map<string, number>();
      for (const item of pkg.items) {
        if (unitPriceByDuration.has(item.durationOptionId)) continue;
        const resolved = price.itemUnitPrices.find(
          (u) => u.durationOptionId === item.durationOptionId,
        );
        unitPriceByDuration.set(item.durationOptionId, resolved?.unitPrice ?? 0);
      }

      await this.cls.run(async () => {
        this.cls.set(TENANT_CLS_KEY, {
          organizationId: DEFAULT_ORG_ID,
          id: 'system',
          role: 'system',
          isSuperAdmin: false,
        });

        await this.rlsTransaction.withTransaction(async (tx) => {
          // Atomic guard: flip ONLY while still PENDING. If a concurrent delivery
          // already flipped it, `count` is 0 and we issue NO credits.
          const flipped = await tx.packagePurchase.updateMany({
            where: { id: packagePurchaseId, status: PackagePurchaseStatus.PENDING },
            data: { status: PackagePurchaseStatus.ACTIVE, paidAt: new Date() },
          });
          if (flipped.count === 0) {
            this.logger.log(
              `Package purchase ${packagePurchaseId} was already activated concurrently — no credits issued`,
            );
            return;
          }

          await tx.packageCredit.createMany({
            data: pkg.items.map((item) => ({
              purchaseId: packagePurchaseId,
              serviceId: item.serviceId,
              employeeId: item.employeeId,
              durationOptionId: item.durationOptionId,
              unitPriceSnapshot: new Prisma.Decimal(
                unitPriceByDuration.get(item.durationOptionId) ?? 0,
              ),
              totalQuantity: item.paidQuantity + item.freeQuantity,
              usedQuantity: 0,
            })),
          });
        });
      });

      this.logger.log(
        `Activated package purchase ${packagePurchaseId} and issued ${pkg.items.length} credit bucket(s) after payment ${paymentId}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to activate package purchase ${packagePurchaseId} after payment ${paymentId}`,
        err,
      );
      throw err;
    }
  }
}
