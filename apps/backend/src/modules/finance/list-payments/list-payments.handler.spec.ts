import { ListPaymentsHandler } from './list-payments.handler';
import { PaymentStatus, PaymentMethod } from '@prisma/client';

const mockPayments = [
  { id: 'pay-1', amount: 100, status: 'COMPLETED', method: 'CARD' as PaymentMethod, invoiceId: 'inv-1', createdAt: new Date() },
];

const buildPrisma = () => ({
  $queryRaw: jest.fn().mockResolvedValue([{id: 'pay-1'}]),
  payment: {
    findMany: jest.fn().mockResolvedValue(mockPayments),
    count: jest.fn().mockResolvedValue(1),
  },
});

describe('ListPaymentsHandler', () => {
  it('returns paginated payments', async () => {
    const prisma = buildPrisma();
    const handler = new ListPaymentsHandler(prisma as never);
    const result = await handler.execute({ page: 1, limit: 10 });
    expect(result.items).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });

  it('filters by status when provided', async () => {
    const prisma = buildPrisma();
    const handler = new ListPaymentsHandler(prisma as never);
    await handler.execute({ status: PaymentStatus.COMPLETED, page: 1, limit: 10 });
    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: PaymentStatus.COMPLETED }) }),
    );
  });

  it('filters by clientId through invoice relation', async () => {
    const prisma = buildPrisma();
    const handler = new ListPaymentsHandler(prisma as never);
    await handler.execute({ clientId: 'client-1', page: 1, limit: 10 });
    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ invoice: { clientId: 'client-1' } }) }),
    );
  });

  it('includes date range filtering', async () => {
    const prisma = buildPrisma();
    const handler = new ListPaymentsHandler(prisma as never);
    const fromDate = new Date('2026-01-01');
    const toDate = new Date('2026-01-31');
    await handler.execute({ fromDate, toDate, page: 1, limit: 10 });
    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: [
          { effectiveReceivedAt: { gte: fromDate, lte: toDate } },
          { effectiveReceivedAt: null, createdAt: { gte: fromDate, lte: toDate } },
        ] }),
      }),
    );
  });
});

it('returns actual collection date and paginates by it instead of entry time', async () => {
 const prisma = buildPrisma();
 prisma.payment.findMany.mockResolvedValue([{...mockPayments[0], effectiveReceivedAt: new Date('2026-09-01'), receiptRecordedBy: 'actor', receiptEvidenceRef: 'receipt', receiptEntryReason: 'late'}] as never);
 const result = await new ListPaymentsHandler(prisma as never).execute({page: 2, limit: 5});
 expect(result.items[0]).toMatchObject({collectionDate: '2026-09-01T00:00:00.000Z', receiptRecordedBy: 'actor', receiptEvidenceRef: 'receipt'});
 expect(prisma.$queryRaw.mock.calls[0][0].sql).toContain('ORDER BY COALESCE(p."effectiveReceivedAt", p."createdAt") DESC, p."id" DESC');
 expect(prisma.$queryRaw.mock.calls[0][0].values).toEqual([5, 5]);
});

it('hydrates a collection-sorted page in SQL order and preserves ordinary CREATED dates', async () => {
  const prisma = buildPrisma();
  prisma.$queryRaw.mockResolvedValue([{id: 'ordinary'}, {id: 'historical'}]);
  prisma.payment.findMany.mockResolvedValue([
    {...mockPayments[0], id: 'historical', createdAt: new Date('2026-10-05'), effectiveReceivedAt: new Date('2026-09-01')},
    {...mockPayments[0], id: 'ordinary', createdAt: new Date('2026-10-01'), processedAt: new Date('2026-10-06'), effectiveReceivedAt: null},
  ] as never);
  const result = await new ListPaymentsHandler(prisma as never).execute({page: 1, limit: 2});
  expect(result.items.map(p => [p.id, p.collectionDate])).toEqual([
    ['ordinary', '2026-10-01T00:00:00.000Z'], ['historical', '2026-09-01T00:00:00.000Z'],
  ]);
});

it('matches bank references while retaining date filters in both page and count queries',async()=>{
 const prisma={...buildPrisma(),client:{findMany:jest.fn().mockResolvedValue([])},invoice:{findMany:jest.fn().mockResolvedValue([])}};
 const fromDate=new Date('2026-10-01'); const toDate=new Date('2026-10-31');
 await new ListPaymentsHandler(prisma as never).execute({search:'BANK_12%',fromDate,toDate,page:1,limit:20});
 expect(prisma.payment.count).toHaveBeenCalledWith({where:expect.objectContaining({
   OR:[{effectiveReceivedAt:{gte:fromDate,lte:toDate}},{effectiveReceivedAt:null,createdAt:{gte:fromDate,lte:toDate}}],
   AND:[{OR:[{invoiceId:{in:[]}},{gatewayRef:{contains:'BANK_12%',mode:'insensitive'}}]}]
 })});
 expect(prisma.$queryRaw.mock.calls[0][0].values).toContain('%BANK\\_12\\%%');
});
