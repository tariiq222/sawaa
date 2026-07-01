import {
  PackageConstraintDimension,
  PackageConstraintMode,
  PackagePurchaseStatus,
} from '@prisma/client';
import { GetMatchingCreditsHandler } from './get-matching-credits.handler';

const CLIENT_ID = '00000000-0000-4000-a000-000000000001';
const SERVICE_ID = '00000000-0000-4000-a000-000000000002';
const EMPLOYEE_ID = '00000000-0000-4000-a000-000000000003';
const DURATION_OPTION_ID = '00000000-0000-4000-a000-000000000004';
const OTHER_SERVICE_ID = '00000000-0000-4000-a000-000000000005';

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

/** A legacy exact credit matches the queried triple via three INCLUDE constraints. */
function exactConstraints() {
  return [
    {
      dimension: PackageConstraintDimension.SERVICE,
      mode: PackageConstraintMode.INCLUDE,
      targets: [{ targetId: SERVICE_ID }],
    },
    {
      dimension: PackageConstraintDimension.PRACTITIONER,
      mode: PackageConstraintMode.INCLUDE,
      targets: [{ targetId: EMPLOYEE_ID }],
    },
    {
      dimension: PackageConstraintDimension.DURATION,
      mode: PackageConstraintMode.INCLUDE,
      targets: [{ targetId: DURATION_OPTION_ID }],
    },
  ];
}

describe('GetMatchingCreditsHandler', () => {
  afterEach(() => jest.clearAllMocks());

  it("queries ONLY the client's ACTIVE-purchase credits (no triple filter in the where)", async () => {
    const { handler, prisma } = buildHandler();

    await handler.execute(query());

    const args = prisma.packageCredit.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      purchase: {
        clientId: CLIENT_ID,
        status: PackagePurchaseStatus.ACTIVE,
      },
    });
    expect(args.where.serviceId).toBeUndefined();
    expect(args.where.employeeId).toBeUndefined();
    expect(args.where.durationOptionId).toBeUndefined();
    expect(args.select.constraints).toEqual({
      select: {
        dimension: true,
        mode: true,
        targets: { select: { targetId: true } },
      },
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
        constraints: [],
      },
      {
        id: 'credit-2', purchaseId: 'p-2', serviceId: SERVICE_ID,
        employeeId: EMPLOYEE_ID, durationOptionId: DURATION_OPTION_ID,
        totalQuantity: 3, usedQuantity: 3, createdAt: new Date(), // exhausted
        constraints: [],
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

  it('filters out credits that do not match the exact (service, employee, duration) triple', async () => {
    const prisma = buildPrisma();
    prisma.packageCredit.findMany.mockResolvedValue([
      {
        id: 'credit-match', purchaseId: 'p-1', serviceId: SERVICE_ID,
        employeeId: EMPLOYEE_ID, durationOptionId: DURATION_OPTION_ID,
        totalQuantity: 5, usedQuantity: 0, createdAt: new Date(),
        constraints: [],
      },
      {
        id: 'credit-other-service', purchaseId: 'p-2', serviceId: OTHER_SERVICE_ID,
        employeeId: EMPLOYEE_ID, durationOptionId: DURATION_OPTION_ID,
        totalQuantity: 5, usedQuantity: 0, createdAt: new Date(),
        constraints: [],
      },
    ]);
    const { handler } = buildHandler(prisma);

    const result = await handler.execute(query());

    expect(result).toHaveLength(1);
    expect(result[0].creditId).toBe('credit-match');
  });

  it('matches a legacy credit via three INCLUDE constraints equivalent to the exact triple', async () => {
    const prisma = buildPrisma();
    prisma.packageCredit.findMany.mockResolvedValue([
      {
        id: 'credit-legacy', purchaseId: 'p-1', serviceId: null,
        employeeId: null, durationOptionId: null,
        totalQuantity: 5, usedQuantity: 0, createdAt: new Date(),
        constraints: exactConstraints(),
      },
    ]);
    const { handler } = buildHandler(prisma);

    const result = await handler.execute(query());

    expect(result).toHaveLength(1);
    expect(result[0].creditId).toBe('credit-legacy');
  });

  it('matches a flexible credit (PRACTITIONER ANY + SERVICE INCLUDE + DURATION ANY) for the same service regardless of employee/duration', async () => {
    const prisma = buildPrisma();
    prisma.packageCredit.findMany.mockResolvedValue([
      {
        id: 'credit-flexible', purchaseId: 'p-1', serviceId: null,
        employeeId: null, durationOptionId: null,
        totalQuantity: 4, usedQuantity: 1, createdAt: new Date(),
        constraints: [
          {
            dimension: PackageConstraintDimension.PRACTITIONER,
            mode: PackageConstraintMode.ANY,
            targets: [],
          },
          {
            dimension: PackageConstraintDimension.SERVICE,
            mode: PackageConstraintMode.INCLUDE,
            targets: [{ targetId: SERVICE_ID }],
          },
          {
            dimension: PackageConstraintDimension.DURATION,
            mode: PackageConstraintMode.ANY,
            targets: [],
          },
        ],
      },
    ]);
    const { handler } = buildHandler(prisma);

    // Query with a different employee/duration than any concrete target — still matches
    // because PRACTITIONER and DURATION are unconstrained (ANY) on this credit.
    const result = await handler.execute({
      clientId: CLIENT_ID,
      serviceId: SERVICE_ID,
      employeeId: '00000000-0000-4000-a000-000000000099',
      durationOptionId: '00000000-0000-4000-a000-000000000098',
    });

    expect(result).toHaveLength(1);
    expect(result[0].creditId).toBe('credit-flexible');
  });

  it('sorts narrowest-first: an exact triple credit outranks a broad flexible credit that also matches', async () => {
    const prisma = buildPrisma();
    prisma.packageCredit.findMany.mockResolvedValue([
      // Returned in FIFO (DB) order: broad flexible credit first, exact credit second.
      {
        id: 'credit-broad', purchaseId: 'p-1', serviceId: null,
        employeeId: null, durationOptionId: null,
        totalQuantity: 10, usedQuantity: 0, createdAt: new Date('2026-01-01'),
        constraints: [
          {
            dimension: PackageConstraintDimension.SERVICE,
            mode: PackageConstraintMode.INCLUDE,
            targets: [{ targetId: SERVICE_ID }],
          },
        ],
      },
      {
        id: 'credit-exact', purchaseId: 'p-2', serviceId: null,
        employeeId: null, durationOptionId: null,
        totalQuantity: 5, usedQuantity: 0, createdAt: new Date('2026-01-02'),
        constraints: exactConstraints(),
      },
    ]);
    const { handler } = buildHandler(prisma);

    const result = await handler.execute(query());

    expect(result.map((c) => c.creditId)).toEqual(['credit-exact', 'credit-broad']);
  });
});
