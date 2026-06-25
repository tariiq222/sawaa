import { PackagePurchaseStatus } from '@prisma/client';
import { GetMatchingCreditsHandler } from './get-matching-credits.handler';

const CLIENT_ID = '00000000-0000-4000-a000-000000000001';
const SERVICE_ID = '00000000-0000-4000-a000-000000000002';
const EMPLOYEE_ID = '00000000-0000-4000-a000-000000000003';
const DURATION_OPTION_ID = '00000000-0000-4000-a000-000000000004';

function buildPrisma() {
  return { packageCredit: { findMany: jest.fn().mockResolvedValue([]) } };
}

function buildHandler(prisma = buildPrisma()) {
  const handler = new GetMatchingCreditsHandler(prisma as never);
  return { handler, prisma };
}

const query = () => ({
  clientId: CLIENT_ID,
  serviceId: SERVICE_ID,
  employeeId: EMPLOYEE_ID,
  durationOptionId: DURATION_OPTION_ID,
});

describe('GetMatchingCreditsHandler', () => {
  afterEach(() => jest.clearAllMocks());

  it('queries ACTIVE credits matching the exact (service, employee, duration) triple for the client', async () => {
    const { handler, prisma } = buildHandler();

    await handler.execute(query());

    const args = prisma.packageCredit.findMany.mock.calls[0][0];
    expect(args.where.serviceId).toBe(SERVICE_ID);
    expect(args.where.employeeId).toBe(EMPLOYEE_ID);
    expect(args.where.durationOptionId).toBe(DURATION_OPTION_ID);
    expect(args.where.purchase).toEqual({
      clientId: CLIENT_ID,
      status: PackagePurchaseStatus.ACTIVE,
    });
  });

  it('orders results FIFO (oldest purchase first)', async () => {
    const { handler, prisma } = buildHandler();

    await handler.execute(query());

    const args = prisma.packageCredit.findMany.mock.calls[0][0];
    expect(args.orderBy).toEqual(
      expect.arrayContaining([{ purchase: { createdAt: 'asc' } }]),
    );
  });

  it('maps each credit to a remaining count and only returns those with remaining > 0', async () => {
    const prisma = buildPrisma();
    prisma.packageCredit.findMany.mockResolvedValue([
      {
        id: 'credit-1', purchaseId: 'p-1', serviceId: SERVICE_ID,
        employeeId: EMPLOYEE_ID, durationOptionId: DURATION_OPTION_ID,
        totalQuantity: 5, usedQuantity: 2, createdAt: new Date(),
      },
      {
        id: 'credit-2', purchaseId: 'p-2', serviceId: SERVICE_ID,
        employeeId: EMPLOYEE_ID, durationOptionId: DURATION_OPTION_ID,
        totalQuantity: 3, usedQuantity: 3, createdAt: new Date(), // exhausted
      },
    ]);
    const { handler } = buildHandler(prisma);

    const result = await handler.execute(query());

    // Only the credit with remaining capacity survives.
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({ creditId: 'credit-1', remaining: 3, totalQuantity: 5, usedQuantity: 2 }),
    );
  });

  it('returns an empty array when the client has no matching active credit', async () => {
    const { handler } = buildHandler();
    const result = await handler.execute(query());
    expect(result).toEqual([]);
  });
});
