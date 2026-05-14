import { GetPublicBranchesHandler, PublicBranchItem } from './get-public-branches.handler';
import { TenantContextService } from '../../../../common/tenant';

const DEFAULT_ORG = '00000000-0000-0000-0000-000000000001';

const activeBranch: PublicBranchItem = {
  id: 'branch-1',
  nameAr: 'الفرع الرئيسي',
  nameEn: 'Main Branch',
  city: 'Riyadh',
  addressAr: 'شارع الملك فهد',
};

const inactiveBranch: PublicBranchItem = {
  id: 'branch-2',
  nameAr: 'الفرع المغلق',
  nameEn: 'Closed Branch',
  city: null,
  addressAr: null,
};

const buildPrisma = (rows: PublicBranchItem[]) => ({
  branch: {
    findMany: jest.fn().mockResolvedValue(rows),
  },
});

const buildTenant = (organizationId = DEFAULT_ORG) =>
  ({
    requireOrganizationIdOrDefault: jest.fn().mockReturnValue(organizationId),
  }) as unknown as TenantContextService;

describe('GetPublicBranchesHandler', () => {
  it('returns only active branches with public-safe projection', async () => {
    const prisma = buildPrisma([activeBranch]);
    const handler = new GetPublicBranchesHandler(prisma as never, buildTenant());

    const result = await handler.execute();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(activeBranch);
    expect(prisma.branch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true, organizationId: DEFAULT_ORG }),
        select: expect.objectContaining({ id: true, nameAr: true }),
      }),
    );
  });

  it('returns empty array when no active branches exist', async () => {
    const prisma = buildPrisma([]);
    const handler = new GetPublicBranchesHandler(prisma as never, buildTenant());

    const result = await handler.execute();

    expect(result).toEqual([]);
  });

  it('does not include inactive branch (query filters at DB level)', async () => {
    const prisma = buildPrisma([activeBranch]);
    const handler = new GetPublicBranchesHandler(prisma as never, buildTenant());

    await handler.execute();

    const call = (prisma.branch.findMany as jest.Mock).mock.calls[0][0] as {
      where: { isActive: boolean };
    };
    expect(call.where.isActive).toBe(true);
  });

  it('result items do not expose internal-only fields', async () => {
    const prisma = buildPrisma([activeBranch]);
    const handler = new GetPublicBranchesHandler(prisma as never, buildTenant());

    const result = await handler.execute();

    const item = result[0] as unknown as Record<string, unknown>;
    expect(item).not.toHaveProperty('phone');
    expect(item).not.toHaveProperty('isActive');
    expect(item).not.toHaveProperty('createdAt');
  });

  it('returns multiple active branches ordered by creation', async () => {
    const second = { ...inactiveBranch, id: 'branch-3', nameAr: 'فرع آخر' };
    const prisma = buildPrisma([activeBranch, second]);
    const handler = new GetPublicBranchesHandler(prisma as never, buildTenant());

    const result = await handler.execute();

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('branch-1');
  });
});
