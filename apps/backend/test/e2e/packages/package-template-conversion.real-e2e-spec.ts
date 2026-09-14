/** Real-DB evidence for legacy-template audit and draft-only conversion. */
import { randomUUID } from 'node:crypto';
import { createRealE2eApp } from '../../helpers/create-real-e2e-app';
import { PrismaService } from '../../../src/infrastructure/database';
import { auditPackageTemplates } from '../../../scripts/data-integrity/audit-package-group-conversion';
import { applyPackageTemplateConversions } from '../../../scripts/convert-package-templates-v2';

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL ? describe : describe.skip;

describeRealE2e('legacy package template conversion (real DB)', () => {
  jest.setTimeout(60_000);

  let app: Awaited<ReturnType<typeof createRealE2eApp>>['app'];
  let prisma: PrismaService;
  const ids = {
    serviceId: randomUUID(),
    employeeId: randomUUID(),
    durationId: randomUUID(),
    sourceId: randomUUID(),
    staleSourceId: randomUUID(),
    needsReviewId: randomUUID(),
    invalidPriceId: randomUUID(),
    draftId: '',
    refreshedDraftId: '',
    purchaseId: randomUUID(),
    creditId: randomUUID(),
    consumedUsageId: randomUUID(),
    reservedUsageId: randomUUID(),
    refundEventId: randomUUID(),
  };

  async function createLegacySource(id: string, name: string) {
    return prisma.sessionPackage.create({
      data: {
        id,
        nameAr: name,
        discountType: 'PERCENTAGE',
        discountValue: 0,
        modelVersion: 'LEGACY',
        isActive: true,
        isPublic: false,
        items: {
          create: {
            serviceId: ids.serviceId,
            employeeId: ids.employeeId,
            durationOptionId: ids.durationId,
            paidQuantity: 5,
            freeQuantity: 1,
            discountType: 'PERCENTAGE',
            discountValue: 10,
            sortOrder: 0,
            constraints: { create: [
              { dimension: 'SERVICE', mode: 'INCLUDE', targets: { create: [{ targetId: ids.serviceId }] } },
              { dimension: 'PRACTITIONER', mode: 'INCLUDE', targets: { create: [{ targetId: ids.employeeId }] } },
              { dimension: 'DURATION', mode: 'INCLUDE', targets: { create: [{ targetId: ids.durationId }] } },
              { dimension: 'DELIVERY_TYPE', mode: 'INCLUDE', targets: { create: [{ targetId: 'IN_PERSON' }] } },
            ] },
          },
        },
      },
      include: { items: true },
    });
  }

  beforeAll(async () => {
    ({ app, prisma } = await createRealE2eApp());
    await prisma.employee.create({ data: { id: ids.employeeId, name: `conversion-${ids.employeeId}`, isActive: true } });
    await prisma.service.create({ data: { id: ids.serviceId, nameAr: `conversion-${ids.serviceId}`, durationMins: 60, price: 5_000, currency: 'SAR', isActive: true } });
    await prisma.serviceBookingConfig.create({ data: { serviceId: ids.serviceId, deliveryType: 'IN_PERSON', isActive: true } });
    await prisma.employeeService.create({ data: { employeeId: ids.employeeId, serviceId: ids.serviceId, isActive: true, useCustomPricing: false } });
    await prisma.serviceDurationOption.create({ data: {
      id: ids.durationId, serviceId: ids.serviceId, deliveryType: 'IN_PERSON', label: '60', labelAr: '٦٠',
      durationMins: 60, price: 5_000, isDefault: true, isActive: true,
    } });
    await createLegacySource(ids.sourceId, `conversion-source-${ids.sourceId}`);
    await createLegacySource(ids.staleSourceId, `conversion-stale-${ids.staleSourceId}`);
    await prisma.sessionPackage.create({
      data: {
        id: ids.needsReviewId, nameAr: `conversion-review-${ids.needsReviewId}`, discountType: 'PERCENTAGE', discountValue: 0,
        modelVersion: 'LEGACY', isActive: true, isPublic: false,
        items: { create: {
          serviceId: ids.serviceId, employeeId: null, durationOptionId: null, unitPrice: 5_000, paidQuantity: 1, freeQuantity: 0,
          constraints: { create: [{ dimension: 'PRACTITIONER', mode: 'ANY', targets: { create: [] } }] },
        } },
      },
    });
    await prisma.packagePurchase.create({
      data: {
        id: ids.purchaseId, packageId: ids.sourceId, clientId: randomUUID(), branchId: randomUUID(),
        modelVersion: 'LEGACY', status: 'ACTIVE', subtotalSnapshot: 25_000, discountSnapshot: 2_500,
        amountPaid: 22_500, refundAmount: 1_000, paidAt: new Date('2026-09-12T12:00:00.000Z'),
        refundedAt: new Date('2026-09-13T12:00:00.000Z'), notes: 'conversion history fixture',
      },
    });
    await prisma.packageCredit.create({
      data: {
        id: ids.creditId, purchaseId: ids.purchaseId, serviceId: ids.serviceId, employeeId: ids.employeeId,
        durationOptionId: ids.durationId, durationMinsSnapshot: 60, deliveryTypeSnapshot: 'IN_PERSON',
        serviceNameSnapshot: 'conversion service', employeeNameSnapshot: 'conversion employee',
        listPriceSnapshot: 5_000, unitPriceSnapshot: 5_000, netValue: 22_500,
        totalQuantity: 6, usedQuantity: 2, reservedQuantity: 1,
        constraints: { create: [
          { dimension: 'SERVICE', mode: 'INCLUDE', targets: { create: [{ targetId: ids.serviceId }] } },
          { dimension: 'PRACTITIONER', mode: 'INCLUDE', targets: { create: [{ targetId: ids.employeeId }] } },
          { dimension: 'DURATION', mode: 'INCLUDE', targets: { create: [{ targetId: ids.durationId }] } },
          { dimension: 'DELIVERY_TYPE', mode: 'INCLUDE', targets: { create: [{ targetId: 'IN_PERSON' }] } },
        ] },
        usages: { create: [
          { id: ids.consumedUsageId, status: 'CONSUMED', bookingId: randomUUID(), consumedAt: new Date('2026-09-12T13:00:00.000Z') },
          { id: ids.reservedUsageId, status: 'RESERVED', bookingId: randomUUID() },
        ] },
      },
    });
    await prisma.packageRefundEvent.create({
      data: {
        id: ids.refundEventId, purchaseId: ids.purchaseId, amount: 1_000, cumulativeRefundAmount: 1_000,
        source: 'LEGACY_REQUEST', refundType: 'PARTIAL', occurredAt: new Date('2026-09-13T12:00:00.000Z'),
        notes: 'conversion refund fixture', legacyAggregateKey: `conversion-${ids.purchaseId}`,
      },
    });
    await prisma.sessionPackage.create({
      data: {
        id: ids.invalidPriceId, nameAr: `conversion-invalid-price-${ids.invalidPriceId}`, discountType: 'PERCENTAGE', discountValue: 0,
        modelVersion: 'LEGACY', isActive: true, isPublic: false,
        items: { create: {
          serviceId: ids.serviceId, employeeId: null, durationOptionId: null, unitPrice: 1.5, paidQuantity: 1, freeQuantity: 0,
          constraints: { create: [{ dimension: 'PRACTITIONER', mode: 'ANY', targets: { create: [] } }] },
        } },
      },
    });
  });

  async function readHistorySnapshot() {
    const purchase = await prisma.packagePurchase.findUniqueOrThrow({
      where: { id: ids.purchaseId },
      include: { credits: { include: { constraints: { include: { targets: true } }, usages: true } } },
    });
    const refunds = await prisma.packageRefundEvent.findMany({ where: { id: ids.refundEventId } });
    return {
      purchase: {
        id: purchase.id,
        packageId: purchase.packageId,
        status: purchase.status,
        subtotalSnapshot: purchase.subtotalSnapshot.toString(),
        discountSnapshot: purchase.discountSnapshot.toString(),
        amountPaid: purchase.amountPaid.toString(),
        refundAmount: purchase.refundAmount.toString(),
        paidAt: purchase.paidAt.toISOString(),
        refundedAt: purchase.refundedAt?.toISOString() ?? null,
        notes: purchase.notes,
        credits: purchase.credits.map((credit) => ({
          id: credit.id,
          serviceId: credit.serviceId,
          employeeId: credit.employeeId,
          durationOptionId: credit.durationOptionId,
          durationMinsSnapshot: credit.durationMinsSnapshot,
          deliveryTypeSnapshot: credit.deliveryTypeSnapshot,
          listPriceSnapshot: credit.listPriceSnapshot?.toString() ?? null,
          unitPriceSnapshot: credit.unitPriceSnapshot.toString(),
          netValue: credit.netValue?.toString() ?? null,
          totalQuantity: credit.totalQuantity,
          usedQuantity: credit.usedQuantity,
          reservedQuantity: credit.reservedQuantity,
          constraints: credit.constraints
            .sort((left, right) => left.dimension.localeCompare(right.dimension))
            .map((constraint) => ({
              dimension: constraint.dimension,
              mode: constraint.mode,
              targets: constraint.targets.map((target) => target.targetId).sort(),
            })),
          usages: credit.usages
            .sort((left, right) => left.id.localeCompare(right.id))
            .map((usage) => ({ id: usage.id, status: usage.status, bookingId: usage.bookingId, consumedAt: usage.consumedAt?.toISOString() ?? null })),
        })),
      },
      refunds: refunds.map((refund) => ({
        id: refund.id,
        purchaseId: refund.purchaseId,
        amount: refund.amount.toString(),
        cumulativeRefundAmount: refund.cumulativeRefundAmount?.toString() ?? null,
        source: refund.source,
        refundType: refund.refundType,
        occurredAt: refund.occurredAt?.toISOString() ?? null,
        notes: refund.notes,
        legacyAggregateKey: refund.legacyAggregateKey,
      })),
    };
  }

  afterAll(async () => {
    if (!prisma) return;
    const conversion = (prisma as unknown as { packageTemplateConversion: { deleteMany(args: unknown): Promise<unknown> } }).packageTemplateConversion;
    if (conversion) await conversion.deleteMany({ where: { sourcePackageId: { in: [ids.sourceId, ids.staleSourceId, ids.needsReviewId, ids.invalidPriceId] } } }).catch(() => undefined);
    await prisma.packageRefundEvent.deleteMany({ where: { id: ids.refundEventId } }).catch(() => undefined);
    await prisma.packageCreditUsage.deleteMany({ where: { id: { in: [ids.consumedUsageId, ids.reservedUsageId] } } }).catch(() => undefined);
    await prisma.packageCredit.deleteMany({ where: { id: ids.creditId } }).catch(() => undefined);
    await prisma.packagePurchase.deleteMany({ where: { id: ids.purchaseId } }).catch(() => undefined);
    await prisma.sessionPackage.deleteMany({ where: { id: { in: [ids.sourceId, ids.staleSourceId, ids.needsReviewId, ids.invalidPriceId, ids.draftId, ids.refreshedDraftId] } } }).catch(() => undefined);
    await prisma.serviceDurationOption.delete({ where: { id: ids.durationId } }).catch(() => undefined);
    await prisma.serviceBookingConfig.deleteMany({ where: { serviceId: ids.serviceId } });
    await prisma.employeeService.deleteMany({ where: { employeeId: ids.employeeId } });
    await prisma.service.delete({ where: { id: ids.serviceId } }).catch(() => undefined);
    await prisma.employee.delete({ where: { id: ids.employeeId } }).catch(() => undefined);
    await app?.close();
  });

  it('dry-run writes nothing, preserves six rights, and apply replays one inactive draft', async () => {
    const db = prisma as never;
    const before = await prisma.sessionPackage.count();
    const historyBefore = await readHistorySnapshot();
    const firstManifest = await auditPackageTemplates(db, { database: 'real-e2e' });
    const secondManifest = await auditPackageTemplates(db, { database: 'real-e2e' });
    expect(await prisma.sessionPackage.count()).toBe(before);
    const mapping = firstManifest.mappings.find((candidate) => candidate.sourcePackageId === ids.sourceId);
    expect(firstManifest.mappings.find((candidate) => candidate.sourcePackageId === ids.needsReviewId)?.classification).toBe('NEEDS_OFFERING_SELECTION');
    expect(firstManifest.mappings.find((candidate) => candidate.sourcePackageId === ids.invalidPriceId)?.classification).toBe('INCONSISTENT');
    expect(mapping?.classification).toBe('READY_DRAFT');
    expect(mapping?.after?.totalRights).toBe(6);
    expect(secondManifest.mappings.find((candidate) => candidate.sourcePackageId === ids.sourceId)?.sourceRevision).toBe(mapping?.sourceRevision);

    const sourceBefore = await prisma.sessionPackage.findUniqueOrThrow({ where: { id: ids.sourceId } });
    const purchasesBefore = await prisma.packagePurchase.count({ where: { packageId: ids.sourceId } });
    const receipts = await Promise.all([
      applyPackageTemplateConversions(db, firstManifest, { selectedSourcePackageIds: [ids.sourceId], expectedDatabase: 'real-e2e', database: 'real-e2e' }),
      applyPackageTemplateConversions(db, firstManifest, { selectedSourcePackageIds: [ids.sourceId], expectedDatabase: 'real-e2e', database: 'real-e2e' }),
    ]);
    ids.draftId = receipts[0][0].draftPackageId;
    expect(receipts[1][0].draftPackageId).toBe(ids.draftId);
    const draft = await prisma.sessionPackage.findUniqueOrThrow({ where: { id: ids.draftId }, include: { groups: { include: { items: true } } } });
    expect(draft.modelVersion).toBe('GROUPED_V2');
    expect(draft.isActive).toBe(false);
    expect(draft.isPublic).toBe(false);
    expect(draft.groups).toHaveLength(1);
    expect(draft.groups[0].sequenceMode).toBe('UNORDERED');
    expect(draft.groups[0].items).toHaveLength(6);
    expect(draft.groups[0].items.reduce((sum, item) => sum + Number(item.unitPrice ?? 0), 0)).toBe(22_500);

    const [replay] = await applyPackageTemplateConversions(db, firstManifest, { selectedSourcePackageIds: [ids.sourceId], expectedDatabase: 'real-e2e', database: 'real-e2e' });
    expect(replay.draftPackageId).toBe(ids.draftId);
    expect(await prisma.sessionPackage.count({ where: { id: ids.draftId } })).toBe(1);
    expect(await prisma.sessionPackage.findUniqueOrThrow({ where: { id: ids.sourceId } })).toMatchObject({ nameAr: sourceBefore.nameAr, updatedAt: sourceBefore.updatedAt });
    expect(await prisma.packagePurchase.count({ where: { packageId: ids.sourceId } })).toBe(purchasesBefore);
    expect(await readHistorySnapshot()).toEqual(historyBefore);
  });

  it('rejects reference-price drift until a refreshed audit manifest is applied', async () => {
    const db = prisma as never;
    const auditedBeforePriceChange = await auditPackageTemplates(db, { database: 'real-e2e' });
    await prisma.serviceDurationOption.update({ where: { id: ids.durationId }, data: { price: 5_500 } });
    await expect(applyPackageTemplateConversions(db, auditedBeforePriceChange, {
      selectedSourcePackageIds: [ids.staleSourceId], expectedDatabase: 'real-e2e', database: 'real-e2e',
    })).rejects.toThrow(/Approved conversion preview changed/);

    const refreshedManifest = await auditPackageTemplates(db, { database: 'real-e2e' });
    expect(refreshedManifest.mappings.find((mapping) => mapping.sourcePackageId === ids.staleSourceId)?.before.finalPrice).toBe(24_750);
    const [receipt] = await applyPackageTemplateConversions(db, refreshedManifest, {
      selectedSourcePackageIds: [ids.staleSourceId], expectedDatabase: 'real-e2e', database: 'real-e2e',
    });
    ids.refreshedDraftId = receipt.draftPackageId;
    expect(receipt.replayed).toBe(false);
  });

  it('rejects a source changed after audit before creating its first draft', async () => {
    const manifest = await auditPackageTemplates(prisma as never, { database: 'real-e2e' });
    const groupedBefore = await prisma.sessionPackage.count({ where: { modelVersion: 'GROUPED_V2', isPublic: false, isActive: false } });
    await prisma.sessionPackage.update({ where: { id: ids.staleSourceId }, data: { nameAr: 'changed after audit' } });
    await expect(applyPackageTemplateConversions(prisma as never, manifest, { selectedSourcePackageIds: [ids.staleSourceId], expectedDatabase: 'real-e2e', database: 'real-e2e' })).rejects.toThrow(/Stale source revision/);
    expect(await prisma.sessionPackage.count({ where: { modelVersion: 'GROUPED_V2', isPublic: false, isActive: false } })).toBe(groupedBefore);
  });
});
