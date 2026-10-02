import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PackagePurchaseStatus, PaymentMethod, Prisma } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { EventBusService } from '../../../../infrastructure/events';
import { ComputePackagePriceService } from '../../../org-experience/compute-package-price.service';
import { ProcessPaymentHandler } from '../../process-payment/process-payment.handler';
import { resolveVatRate } from '../../create-invoice/create-invoice.handler';
import { computeVat } from '../../money.helper';
import { buildCreditConstraintCreate } from '../build-credit-constraints.helper';
import { resolvePackageGroupOfferings } from '../../../org-experience/session-packages/package-group-offering.helper';
import { decorateGroupedPackage } from '../../../org-experience/session-packages/package-group-catalog.helper';
import {
  createGroupedPackagePurchaseSnapshot,
  GROUPED_PURCHASE_MODEL_VERSION,
  issueGroupedPackageCredits,
  parseGroupedPackagePurchaseSnapshot,
  type GroupedPackagePurchaseSnapshot,
} from '../package-group-purchase-snapshot';
import { CreatePackagePurchaseDto } from './create-package-purchase.dto';
import { buildPackageOfferSnapshot } from '../package-offer-snapshot';

export type CreatePackagePurchaseCommand = CreatePackagePurchaseDto & {
  /** Optional override of the authenticated user id (set by the controller). */
  userId?: string;
};

export function packagePurchaseRequestFingerprint(
  dto: Pick<
    CreatePackagePurchaseCommand,
    'packageId' | 'packageFamilyId' | 'clientId' | 'branchId' | 'employeeId' | 'method' | 'notes'
  >,
): string {
  const canonical = JSON.stringify({
    packageId: dto.packageId,
    ...(dto.packageFamilyId ? { packageFamilyId: dto.packageFamilyId } : {}),
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
        groups: {
          orderBy: { sortOrder: 'asc' },
          include: {
            dependsOnGroup: { select: { key: true } },
            items: {
              orderBy: { sessionPosition: 'asc' },
              include: { constraints: { include: { targets: true } } },
            },
          },
        },
        items: {
          orderBy: { sortOrder: 'asc' },
          include: { constraints: { include: { targets: true } } },
        },
        family: { select: { id: true, nameAr: true, nameEn: true, isActive: true, isPublic: true, archivedAt: true } },
      },
    });
    if (!pkg) {
      throw new NotFoundException(`SessionPackage ${dto.packageId} not found`);
    }
    if (!pkg.isActive) {
      throw new BadRequestException('SessionPackage is not active');
    }
    if (pkg.familyId) {
      if (dto.packageFamilyId !== pkg.familyId) throw new BadRequestException('Selected package option does not belong to the requested family');
      if (!pkg.family || !pkg.family.isActive || !pkg.family.isPublic || pkg.family.archivedAt) throw new BadRequestException('Package family is not available');
      if (!pkg.isPublic) throw new BadRequestException('Package option is not public');
    } else if (dto.packageFamilyId) {
      throw new BadRequestException('Selected package is not attached to the requested family');
    }

    let groupedSnapshot: GroupedPackagePurchaseSnapshot | null = null;
    let groupedPrice: { subtotal: number; discountAmount: number; finalPrice: number; itemUnitPrices: { unitPrice: number }[]; lines: { net: number }[] } | null = null;
    if (pkg.modelVersion === GROUPED_PURCHASE_MODEL_VERSION) {
      const decorated = decorateGroupedPackage(pkg);
      const resolved = await resolvePackageGroupOfferings(this.prisma, decorated.groups);
      const built = createGroupedPackagePurchaseSnapshot(
        resolved.map((group, index) => ({ ...group, sortOrder: index })),
        decorated.globalDiscount,
      );
      groupedSnapshot = built.snapshot;
      groupedPrice = built.price;
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
    const price = groupedPrice ?? await this.pricing.compute({
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
      // VAT sits on top of the net package price, like booking invoices.
      // amountPaid stays NET (the credit-valuation basis); the invoice and the
      // collected payment are GROSS.
      const vatRate = await resolveVatRate(tx);
      const vat = computeVat(new Prisma.Decimal(price.finalPrice), vatRate);
      const grossTotal = vat.totalHalalas.toNumber();
      const purchase = await tx.packagePurchase.create({
        data: {
          idempotencyKey: dto.idempotencyKey,
          requestFingerprint,
          packageId: pkg.id,
          offerSnapshot: buildPackageOfferSnapshot(pkg) as unknown as Prisma.InputJsonValue,
          clientId: dto.clientId,
          branchId: dto.branchId,
          status: PackagePurchaseStatus.ACTIVE,
          ...(groupedSnapshot && {
            modelVersion: GROUPED_PURCHASE_MODEL_VERSION,
            creditSnapshot: groupedSnapshot as unknown as Prisma.InputJsonValue,
          }),
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
      if (groupedSnapshot) {
        await issueGroupedPackageCredits(tx, purchase.id, groupedSnapshot);
      }
      for (let idx = 0; idx < (groupedSnapshot ? 0 : pkg.items.length); idx++) {
        const item = pkg.items[idx];
        await tx.packageCredit.create({
          data: {
            purchaseId: purchase.id,
            serviceId: item.serviceId,
            employeeId: item.employeeId,
            durationOptionId: item.durationOptionId,
            unitPriceSnapshot: new Prisma.Decimal(unitPriceByIndex[idx] ?? 0),
            // Net paid for this item's sessions (after its discount), so reports
            // value remaining sessions at what the client actually paid.
            netValue:
              price.lines?.[idx] != null
                ? new Prisma.Decimal(price.lines[idx].net)
                : null,
            totalQuantity: item.paidQuantity + item.freeQuantity,
            usedQuantity: 0,
            constraints: { create: buildCreditConstraintCreate(item) },
          },
        });
      }

      // Single invoice for the full package. VAT follows OrganizationSettings
      // (0 unless enabled). status=DRAFT ("awaiting payment") so
      // ProcessPaymentHandler stamps issuedAt and flips it to PAID.
      const invoice = await tx.invoice.create({
        data: {
          branchId: dto.branchId,
          clientId: dto.clientId,
          // employeeId is optional in the DTO; default to the first item's
          // employee so the invoice always has a human on it (mirror of the
          // old bundle handler which required employeeId at the top level).
          employeeId: dto.employeeId ?? groupedSnapshot?.groups[0]?.employeeId ?? pkg.items[0]?.employeeId ?? '',
          bookingId: null,
          packagePurchaseId: purchase.id,
          subtotal: new Prisma.Decimal(price.subtotal),
          discountAmt: new Prisma.Decimal(price.discountAmount),
          vatRate,
          vatAmt: vat.vatAmtHalalas,
          total: vat.totalHalalas,
          status: groupedSnapshot && grossTotal === 0 ? 'PAID' : 'DRAFT',
          ...(groupedSnapshot && grossTotal === 0 && { issuedAt: new Date(), paidAt: new Date() }),
          notes: dto.notes ?? null,
        },
      });

      const payment = groupedSnapshot && grossTotal === 0
        ? null
        : await this.processPayment.execute({
            invoiceId: invoice.id,
            amount: grossTotal,
            method: dto.method,
            // Deterministic idempotency key per purchase — replaying this exact sale
            // (dashboard retry, double-click) collapses to the existing Payment row.
            idempotencyKey: `pkg-purchase:${purchase.id}`,
            transaction: tx,
          });

      return { purchase, invoiceId: invoice.id, invoiceTotal: grossTotal, payment };
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

    const { purchase, invoiceId, invoiceTotal, payment } = sale;

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
        total: invoiceTotal,
      },
    });

    // Return the purchase + a snapshot of the credits we just created so the
    // dashboard can render the "sale success" view without a refetch.
    return {
      purchase,
      invoiceId,
      paymentId: payment?.id ?? null,
      credits: groupedSnapshot
        ? groupedSnapshot.credits.map((credit) => ({
          ...credit,
          usedQuantity: 0,
          reservedQuantity: 0,
        }))
        : pkg.items.map((item, idx) => ({
          serviceId: item.serviceId,
          employeeId: item.employeeId,
          durationOptionId: item.durationOptionId,
          unitPriceSnapshot: unitPriceByIndex[idx] ?? 0,
          totalQuantity: item.paidQuantity + item.freeQuantity,
          usedQuantity: 0,
          // No booking exists yet at purchase time, so nothing is reserved.
          reservedQuantity: 0,
        })),
    };
  }

  private async replaySale(purchase: {
    id: string;
    requestFingerprint: string | null;
    [key: string]: unknown;
  }) {
    const modelVersion = (purchase as { modelVersion?: string }).modelVersion;
    const invoice = await this.prisma.invoice.findUnique({
      where: { packagePurchaseId: purchase.id },
      select: { id: true, total: true, status: true },
    });
    if (!invoice) {
      throw new ConflictException('Package purchase replay is missing its invoice');
    }
    const payment = await this.prisma.payment.findFirst({
      where: { invoiceId: invoice.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    const isFreeGroupedSale = modelVersion === GROUPED_PURCHASE_MODEL_VERSION &&
      Number((purchase as { amountPaid?: unknown }).amountPaid ?? 0) === 0 &&
      Number(invoice.total) === 0 && invoice.status === 'PAID';
    if (!payment && !isFreeGroupedSale) {
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
        netValue: true,
        totalQuantity: true,
        usedQuantity: true,
        reservedQuantity: true,
        sessionPosition: true,
        purchaseGroup: { select: { key: true, sortOrder: true } },
      },
    });
    if (modelVersion === GROUPED_PURCHASE_MODEL_VERSION) {
      const snapshot = parseGroupedPackagePurchaseSnapshot(
        (purchase as { creditSnapshot?: Prisma.JsonValue | null }).creditSnapshot ?? null,
      );
      if (credits.length !== snapshot.credits.length || credits.some((credit) => !credit.purchaseGroup || credit.sessionPosition === null)) {
        throw new ConflictException('Package purchase replay has an incomplete grouped credit set');
      }
      const byIdentity = new Map(credits.map((credit) => [
        `${credit.purchaseGroup?.key ?? ''}:${credit.sessionPosition ?? -1}`,
        credit,
      ]));
        return {
        purchase,
        invoiceId: invoice.id,
        paymentId: payment?.id ?? null,
        credits: snapshot.credits.map((credit) => {
          const row = byIdentity.get(`${credit.groupKey}:${credit.sessionPosition}`);
          if (!row || row.serviceId !== credit.serviceId || row.employeeId !== credit.employeeId ||
            row.durationOptionId !== credit.durationOptionId || Number(row.unitPriceSnapshot) !== credit.unitPriceSnapshot ||
            Number(row.netValue ?? -1) !== credit.netValue || row.totalQuantity !== 1) {
            throw new ConflictException('Package purchase replay has corrupted grouped credit rows');
          }
          return {
            ...credit,
            usedQuantity: row.usedQuantity,
            reservedQuantity: row.reservedQuantity,
          };
        }),
      };
    }
    return {
      purchase,
      invoiceId: invoice.id,
      paymentId: payment!.id,
      credits: credits.map((credit) => ({
        ...credit,
        unitPriceSnapshot: Number(credit.unitPriceSnapshot),
      })),
    };
  }
}
