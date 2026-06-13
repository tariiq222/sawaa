import { GetPublicBranchesHandler, PublicBranchItem } from './get-public-branches.handler';

const activeBranchMain: PublicBranchItem = {
  id: 'branch-1',
  nameAr: 'الفرع الرئيسي',
  nameEn: 'Main Branch',
  city: 'Riyadh',
  addressAr: 'شارع الملك فهد',
  isMain: true,
};

const activeBranchSecondary: PublicBranchItem = {
  id: 'branch-2',
  nameAr: 'فرع آخر',
  nameEn: 'Secondary Branch',
  city: null,
  addressAr: null,
  isMain: false,
};

const buildPrisma = (rows: PublicBranchItem[]) => ({
  branch: {
    findMany: jest.fn().mockResolvedValue(rows),
  },
});


describe('GetPublicBranchesHandler', () => {
  it('returns only active branches with public-safe projection', async () => {
    const prisma = buildPrisma([activeBranchMain]);
    const handler = new GetPublicBranchesHandler(prisma as never);

    const result = await handler.execute();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(activeBranchMain);
    expect(prisma.branch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
        select: expect.objectContaining({ id: true, nameAr: true, isMain: true }),
      }),
    );
  });

  it('returns empty array when no active branches exist', async () => {
    const prisma = buildPrisma([]);
    const handler = new GetPublicBranchesHandler(prisma as never);

    const result = await handler.execute();

    expect(result).toEqual([]);
  });

  it('does not include inactive branch (query filters at DB level)', async () => {
    const prisma = buildPrisma([activeBranchMain]);
    const handler = new GetPublicBranchesHandler(prisma as never);

    await handler.execute();

    const call = (prisma.branch.findMany as jest.Mock).mock.calls[0][0] as {
      where: { isActive: boolean };
    };
    expect(call.where.isActive).toBe(true);
  });

  it('result items do not expose internal-only fields', async () => {
    const prisma = buildPrisma([activeBranchMain]);
    const handler = new GetPublicBranchesHandler(prisma as never);

    const result = await handler.execute();

    const item = result[0] as unknown as Record<string, unknown>;
    expect(item).not.toHaveProperty('phone');
    expect(item).not.toHaveProperty('isActive');
    expect(item).not.toHaveProperty('createdAt');
  });

  it('includes isMain flag in returned items', async () => {
    const prisma = buildPrisma([activeBranchMain, activeBranchSecondary]);
    const handler = new GetPublicBranchesHandler(prisma as never);

    const result = await handler.execute();

    expect(result[0]).toHaveProperty('isMain', true);
    expect(result[1]).toHaveProperty('isMain', false);
  });

  it('orders main branch first (isMain: desc) via orderBy', async () => {
    // The DB returns rows in whatever order Prisma applies — mock simulates main-first ordering.
    const prisma = buildPrisma([activeBranchMain, activeBranchSecondary]);
    const handler = new GetPublicBranchesHandler(prisma as never);

    const result = await handler.execute();

    // Verify the orderBy sent to Prisma contains isMain: 'desc' as first sort key.
    const call = (prisma.branch.findMany as jest.Mock).mock.calls[0][0] as {
      orderBy: Array<Record<string, string>>;
    };
    expect(Array.isArray(call.orderBy)).toBe(true);
    expect(call.orderBy[0]).toEqual({ isMain: 'desc' });
    expect(call.orderBy[1]).toEqual({ createdAt: 'asc' });

    // Result order (from mock) has main branch at index 0.
    expect(result[0].isMain).toBe(true);
    expect(result[0].id).toBe('branch-1');
  });

  it('returns multiple active branches ordered by creation as tiebreak', async () => {
    const prisma = buildPrisma([activeBranchMain, activeBranchSecondary]);
    const handler = new GetPublicBranchesHandler(prisma as never);

    const result = await handler.execute();

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('branch-1');
  });
});
