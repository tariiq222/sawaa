import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PackagePurchaseStatus, PaymentMethod, Prisma } from '@prisma/client';
import { stableEventId } from '../../../../common/events';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { EventBusService } from '../../../../infrastructure/events';
import { ComputePackagePriceService } from '../../../org-experience/compute-package-price.service';
import {
  type DeferredPaymentEvent,
  ProcessPaymentHandler,
} from '../../process-payment/process-payment.handler';
import { buildCreditConstraintCreate } from '../build-credit-constraints.helper';
import { CreatePackagePurchaseDto } from './create-package-purchase.dto';

export type CreatePackagePurchaseCommand = CreatePackagePurchaseDto & {
  /** Optional override of the authenticated user id (set by the controller). */
  userId?: string;
};

export function packagePurchaseRequestFingerprint(
  dto: Pick<
    CreatePackagePurchaseCommand,
    'packageId' | 'clientId' | 'branchId' | 'employeeId' | 'method' | 'notes'
  >,
): string {
  const canonical = JSON.stringify({
    packageId: dto.packageId,
    clientId: dto.clientId,
    branchId: dto.branchId,
    employeeId: dto.employeeId ?? null,
    method: dto.method,
    notes: dto.notes?.trim() || null,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Reception-side manual sale of a SessionPackage to a client.
 *
 * Pipeline (one transaction so a concurrent insert cannot split the snapshot
 * from the credit buckets):
 *  1. Load the SessionPackage + items; 404 if missing/archived; reject if
 *     `isActive = false` (a deactivated package is not sellable, even if the
 *     row still exists).
 *  2. Verify the client exists.
 *  3. Freeze prices via ComputePackagePriceService so the snapshot is exactly
 *     what the dashboard saw at sale time.
 *  4. Create the PackagePurchase (status=ACTIVE) + one PackageCredit per item
 *     with `totalQuantity = paidQuantity + freeQuantity` and the per-item
 *     `unitPriceSnapshot` from the resolved unit price.
 *  5. Issue ONE invoice linked via `packagePurchaseId`, total = finalPrice,
 *     VAT = 0 (the center is not VAT-registered; CLAUDE.md).
 *  6. Record the manual payment via ProcessPaymentHandler (full finalPrice) —
 *     that handler is the only authority for invoice-status updates + payment
 *     row insertion, so we reuse it rather than re-implementing the tripwire.
 *  7. Stage the payment-completed event in the transactional outbox.
 *  8. Publish the optional `finance.invoice.created` observation after commit.
 *
 * Multiple ACTIVE purchases of the same package for the same client are
 * intentionally ALLOWED (unlike the old BundlePurchase duplicate check) —
 * the plan's "التعدد" decision.
 */
@Injectable()
export class CreatePackagePurchaseHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly pricing: ComputePackagePriceService,
    private readonly processPayment: ProcessPaymentHandler,
    private readonly eventBus: EventBusService,
  ) {}

  async execute(dto: CreatePackagePurchaseCommand) {
    // ONLINE_CARD is rejected up-front: manual-payment recording must not
    // create a card row without the Moyasar webhook. Mirrors the same guard
    // inside ProcessPaymentHandler, but rejecting here keeps the API surface
    // explicit and surfaces the failure before the transaction starts.
    if (dto.method === PaymentMethod.ONLINE_CARD) {
      throw new BadRequestException(
        'ONLINE_CARD payments must come through the Moyasar webhook flow, not the reception manual-payment endpoint',
      );
    }
    if (dto.method === PaymentMethod.COUPON) {
      throw new BadRequestException(
        'COUPON payments must use the coupon redemption flow, not package purchase payment recording',
      );
    }

    const requestFingerprint = packagePurchaseRequestFingerprint(dto);
    const existingPurchase = await this.prisma.packagePurchase.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existingPurchase) {
      if (existingPurchase.requestFingerprint !== requestFingerprint) {
        throw new ConflictException(
          'Package purchase idempotency key was already used with a different request',
        );
      }
      return this.replaySale(existingPurchase);
    }

    // 1. Load the package definition (cross-BC IDs — items are real FK rows).
    const pkg = await this.prisma.sessionPackage.findFirst({
      where: { id: dto.packageId, archivedAt: null },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          include: { constraints: { include: { targets: true } } },
        },
      },
    });
    if (!pkg) {
      throw new NotFoundException(`SessionPackage ${dto.packageId} not found`);
    }
    if (!pkg.isActive) {
      throw new BadRequestException('SessionPackage is not active');
    }

    // 2. Verify the client exists. Cross-BC — no FK, so a manual check is
    // required. This mirrors the old bundle-purchase guard.
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId },
      select: { id: true },
    });
    if (!client) {
      throw new NotFoundException(`Client ${dto.clientId} not found`);
    }

    // 3. Freeze the price. Discount now lives on each item; for PERCENTAGE it's
    // the percentage itself (e.g. 10 = 10%), for FIXED it's integer halalas —
    // both forms are exactly what ComputePackagePriceService expects (the
    // Create/Update handlers already normalised them at write time).
    const price = await this.pricing.compute({
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

    // itemUnitPrices aligns 1:1 with pkg.items (same order); index-key it so
    // flexible items (no durationOptionId) resolve their unit price too.
    const unitPriceByIndex = price.itemUnitPrices.map((u) => u.unitPrice);

    // 4 + 5 + 6: create purchase, credits, invoice, and manual payment in one
    // transaction. A payment failure therefore rolls the ACTIVE purchase and
    // its spendable credits back with the invoice.
    const createSale = () => this.rlsTransaction.withTransaction(async (tx) => {
      const purchase = await tx.packagePurchase.create({
        data: {
          idempotencyKey: dto.idempotencyKey,
          requestFingerprint,
          packageId: pkg.id,
          clientId: dto.clientId,
          branchId: dto.branchId,
          status: PackagePurchaseStatus.ACTIVE,
          subtotalSnapshot: new Prisma.Decimal(price.subtotal),
          discountSnapshot: new Prisma.Decimal(price.discountAmount),
          amountPaid: new Prisma.Decimal(price.finalPrice),
          paidAt: new Date(),
          notes: dto.notes ?? null,
        },
      });

      // One PackageCredit per SessionPackageItem. The total quantity includes
      // free sessions (paid=0, free≥1 is the free-only item shape per plan).
      // `unitPriceSnapshot` is the per-item unit price (not the subtotal) so
      // the FIFO credit-consumption logic in Phase 3 has the right number.
      // Per-credit create (not createMany) so each credit snapshots its item's
      // eligibility constraints — the rule the matching engine reads at booking.
      for (let idx = 0; idx < pkg.items.length; idx++) {
        const item = pkg.items[idx];
        await tx.packageCredit.create({
          data: {
            purchaseId: purchase.id,
            serviceId: item.serviceId,
            employeeId: item.employeeId,
            durationOptionId: item.durationOptionId,
            unitPriceSnapshot: new Prisma.Decimal(unitPriceByIndex[idx] ?? 0),
            totalQuantity: item.paidQuantity + item.freeQuantity,
            usedQuantity: 0,
            constraints: { create: buildCreditConstraintCreate(item) },
          },
        });
      }

      // Single invoice for the full finalPrice. VAT = 0 — center is not
      // VAT-registered. status=DRAFT ("awaiting payment") so ProcessPaymentHandler
      // stamps issuedAt and flips it to PAID when it inserts the payment row.
      const invoice = await tx.invoice.create({
        data: {
          branchId: dto.branchId,
          clientId: dto.clientId,
          // employeeId is optional in the DTO; default to the first item's
          // employee so the invoice always has a human on it (mirror of the
          // old bundle handler which required employeeId at the top level).
          employeeId: dto.employeeId ?? pkg.items[0]?.employeeId ?? '',
          bookingId: null,
          packagePurchaseId: purchase.id,
          subtotal: new Prisma.Decimal(price.subtotal),
          discountAmt: new Prisma.Decimal(price.discountAmount),
          vatRate: new Prisma.Decimal(0),
          vatAmt: new Prisma.Decimal(0),
          total: new Prisma.Decimal(price.finalPrice),
          status: 'DRAFT',
          notes: dto.notes ?? null,
        },
      });

      const payment = await this.processPayment.execute({
        invoiceId: invoice.id,
        amount: price.finalPrice,
        method: dto.method,
        // Deterministic idempotency key per purchase — replaying this exact sale
        // (dashboard retry, double-click) collapses to the existing Payment row.
        idempotencyKey: `pkg-purchase:${purchase.id}`,
        transaction: tx,
      });

      await this.stagePaymentEvents(
        tx,
        invoice.id,
        purchase.id,
        payment.id,
        payment.deferredEvents,
      );

      return { purchase, invoiceId: invoice.id, payment };
    });

    let sale: Awaited<ReturnType<typeof createSale>>;
    try {
      sale = await createSale();
    } catch (error) {
      const isIdempotencyRace =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
      if (!isIdempotencyRace) {
        throw error;
      }

      // A concurrent request with the same idempotency key won the unique-key
      // race after our initial lookup. Replay only when its canonical request
      // is identical; a reused key with different inputs is always a conflict.
      const winner = await this.prisma.packagePurchase.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (!winner) {
        throw error;
      }
      if (winner.requestFingerprint !== requestFingerprint) {
        throw new ConflictException(
          'Package purchase idempotency key was already used with a different request',
        );
      }
      return this.replaySale(winner);
    }

    const { purchase, invoiceId, payment } = sale;

    // 8. Publish outside the transaction (consistent with the rest of the
    // finance cluster — events must only fire for committed work).
    await this.eventBus.publishOptional('finance.invoice.created', {
      eventId: invoiceId,
      source: 'finance',
      version: 1,
      occurredAt: new Date(),
      payload: {
        invoiceId,
        bookingId: null,
        packagePurchaseId: purchase.id,
        clientId: dto.clientId,
        total: price.finalPrice,
      },
    });

    // Return the purchase + a snapshot of the credits we just created so the
    // dashboard can render the "sale success" view without a refetch.
    return {
      purchase,
      invoiceId,
      paymentId: payment.id,
      credits: pkg.items.map((item, idx) => ({
        serviceId: item.serviceId,
        employeeId: item.employeeId,
        durationOptionId: item.durationOptionId,
        unitPriceSnapshot: unitPriceByIndex[idx] ?? 0,
        totalQuantity: item.paidQuantity + item.freeQuantity,
        usedQuantity: 0,
      })),
    };
  }

  private async stagePaymentEvents(
    tx: Prisma.TransactionClient,
    invoiceId: string,
    purchaseId: string,
    paymentId: string,
    events: readonly DeferredPaymentEvent[] | undefined,
  ): Promise<void> {
    const completedEvent = events?.find(
      (event) => event.eventName === 'finance.payment.completed',
    );
    if (!completedEvent) {
      throw new ConflictException(
        'Manual package payment completed without a durable payment event',
      );
    }

    const eventId = stableEventId(
      `finance:manual-package-purchase:${paymentId}:${completedEvent.eventName}`,
    );
    await tx.outboxEvent.create({
      data: {
        id: eventId,
        aggregateId: invoiceId,
        eventType: completedEvent.eventName,
        status: 'PENDING_V2',
        deliveryLane: 'PENDING_V2',
        payload: {
          ...completedEvent.envelope,
          eventId,
          payload: {
            ...completedEvent.envelope.payload,
            packagePurchaseId: purchaseId,
          },
        } as Prisma.InputJsonValue,
      },
    });
  }

  private async replaySale(purchase: {
    id: string;
    requestFingerprint: string | null;
    [key: string]: unknown;
  }) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { packagePurchaseId: purchase.id },
      select: { id: true },
    });
    if (!invoice) {
      throw new ConflictException('Package purchase replay is missing its invoice');
    }
    const payment = await this.prisma.payment.findFirst({
      where: { invoiceId: invoice.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!payment) {
      throw new ConflictException('Package purchase replay is missing its payment');
    }
    const credits = await this.prisma.packageCredit.findMany({
      where: { purchaseId: purchase.id },
      orderBy: { createdAt: 'asc' },
      select: {
        serviceId: true,
        employeeId: true,
        durationOptionId: true,
        unitPriceSnapshot: true,
        totalQuantity: true,
        usedQuantity: true,
      },
    });
    return {
      purchase,
      invoiceId: invoice.id,
      paymentId: payment.id,
      credits: credits.map((credit) => ({
        ...credit,
        unitPriceSnapshot: Number(credit.unitPriceSnapshot),
      })),
    };
  }
}
