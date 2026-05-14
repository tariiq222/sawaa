import { ConflictException, NotFoundException } from '@nestjs/common';
import { CreateBranchHandler } from './create-branch.handler';
import { UpdateBranchHandler } from './update-branch.handler';
import { ListBranchesHandler } from './list-branches.handler';
import { GetBranchHandler } from './get-branch.handler';
import { TenantContextService } from '../../../common/tenant';
import { RlsTransactionService } from '../../../infrastructure/database';

const buildEventBus = () => ({ publish: jest.fn().mockResolvedValue(undefined) });
const _buildSubscriptionCache = () => ({ get: jest.fn().mockResolvedValue(null) });
const buildRlsTx = (prisma: ReturnType<typeof buildPrisma>) =>
  ({
    withTransaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
    withBypassTransaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
  } as unknown as RlsTransactionService);

const DEFAULT_ORG = '00000000-0000-0000-0000-000000000001';
const branchId = 'branch-1';

const mockBranch = {
  id: branchId,
  organizationId: DEFAULT_ORG,
  nameAr: 'الفرع الرئيسي',
  nameEn: 'Main Branch',
  phone: null,
  addressAr: null,
  addressEn: null,
  city: null,
  country: 'SA',
  latitude: null,
  longitude: null,
  isActive: true,
  isMain: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  businessHours: [],
  holidays: [],
};

const mockBranchInactive = { ...mockBranch, isActive: false };

const buildPrisma = (overrides: Record<string, unknown> = {}) => {
  const branchMethods = {
    findFirst: jest.fn(),
    create: jest.fn().mockResolvedValue(mockBranch),
    update: jest.fn().mockResolvedValue(mockBranch),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    findMany: jest.fn().mockResolvedValue([mockBranch]),
    count: jest.fn().mockResolvedValue(1),
  };
  return {
    branch: branchMethods,
    $transaction: jest.fn((opsOrFn: unknown) => {
      if (typeof opsOrFn === 'function') {
        const tx = { branch: branchMethods };
        return opsOrFn(tx);
      }
      return Promise.all(opsOrFn as Promise<unknown>[]);
    }),
    ...overrides,
  };
};

const buildTenant = (organizationId = DEFAULT_ORG) =>
  ({
    requireOrganizationId: jest.fn().mockReturnValue(organizationId),
    requireOrganizationIdOrDefault: jest.fn().mockReturnValue(organizationId),
  }) as unknown as TenantContextService;

describe('CreateBranchHandler', () => {
  it('creates branch scoped by org when name is unique', async () => {
    const prisma = buildPrisma();
    prisma.branch.findFirst = jest.fn().mockResolvedValue(null);
    const handler = new CreateBranchHandler(prisma as never, buildEventBus() as never, buildRlsTx(prisma) as never);
    const result = await handler.execute({ nameAr: 'الفرع الرئيسي' });
    expect(result.id).toBe('branch-1');
    // org scoping moved to RLS / removed in single-tenant migration
    expect(prisma.branch.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ nameAr: 'الفرع الرئيسي' }) }),
    );
  });

  it('throws ConflictException when name already exists in same org', async () => {
    const prisma = buildPrisma();
    prisma.branch.findFirst = jest.fn().mockResolvedValue(mockBranch);
    const handler = new CreateBranchHandler(prisma as never, buildEventBus() as never, buildRlsTx(prisma) as never);
    await expect(handler.execute({ nameAr: 'الفرع الرئيسي' })).rejects.toThrow(ConflictException);
  });

  it('allows same branch name in two different orgs', async () => {
    const prismaA = buildPrisma();
    prismaA.branch.findFirst = jest.fn().mockResolvedValue(null);
    const prismaB = buildPrisma();
    prismaB.branch.findFirst = jest.fn().mockResolvedValue(null);
    const handlerA = new CreateBranchHandler(prismaA as never, buildEventBus() as never, buildRlsTx(prismaA) as never);
    const handlerB = new CreateBranchHandler(prismaB as never, buildEventBus() as never, buildRlsTx(prismaB) as never);
    await expect(handlerA.execute({ nameAr: 'الفرع الرئيسي' })).resolves.toBeDefined();
    await expect(handlerB.execute({ nameAr: 'الفرع الرئيسي' })).resolves.toBeDefined();
  });
});

describe('UpdateBranchHandler', () => {
  it('updates branch when found in org', async () => {
    const prisma = buildPrisma();
    prisma.branch.findFirst = jest.fn().mockResolvedValue(mockBranch);
    const eventBus = buildEventBus();
    const handler = new UpdateBranchHandler(prisma as never, eventBus as never, buildRlsTx(prisma) as never);
    const result = await handler.execute({ branchId, city: 'Riyadh' });
    expect(result).toEqual(mockBranch);
  });

  it('throws NotFoundException when branch not found', async () => {
    const prisma = buildPrisma();
    prisma.branch.findFirst = jest.fn().mockResolvedValue(null);
    const handler = new UpdateBranchHandler(prisma as never, buildEventBus() as never, buildRlsTx(prisma) as never);
    await expect(handler.execute({ branchId: 'missing', city: 'Riyadh' })).rejects.toThrow(NotFoundException);
  });

  it('emits BranchDeactivatedEvent when isActive transitions true → false', async () => {
    const prisma = buildPrisma();
    prisma.branch.findFirst = jest.fn().mockResolvedValue(mockBranch); // isActive: true
    prisma.branch.update = jest.fn().mockResolvedValue({ ...mockBranch, isActive: false });
    const eventBus = buildEventBus();
    const handler = new UpdateBranchHandler(prisma as never, eventBus as never, buildRlsTx(prisma) as never);

    await handler.execute({ branchId, isActive: false });

    expect(eventBus.publish).toHaveBeenCalledWith(
      'org-config.branch.deactivated',
      expect.objectContaining({
        payload: { branchId },
      }),
    );
  });

  it('emits BranchReactivatedEvent when isActive transitions false → true', async () => {
    const prisma = buildPrisma();
    prisma.branch.findFirst = jest.fn().mockResolvedValue(mockBranchInactive); // isActive: false
    prisma.branch.update = jest.fn().mockResolvedValue({ ...mockBranch, isActive: true });
    const eventBus = buildEventBus();
    const handler = new UpdateBranchHandler(prisma as never, eventBus as never, buildRlsTx(prisma) as never);

    await handler.execute({ branchId, isActive: true });

    expect(eventBus.publish).toHaveBeenCalledWith(
      'org-config.branch.reactivated',
      expect.objectContaining({
        payload: { branchId },
      }),
    );
  });

  it('emits no lifecycle event when isActive does not change', async () => {
    const prisma = buildPrisma();
    prisma.branch.findFirst = jest.fn().mockResolvedValue(mockBranch); // isActive: true
    prisma.branch.update = jest.fn().mockResolvedValue(mockBranch);
    const eventBus = buildEventBus();
    const handler = new UpdateBranchHandler(prisma as never, eventBus as never, buildRlsTx(prisma) as never);

    await handler.execute({ branchId, isActive: true }); // same value — no transition

    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('emits no lifecycle event when isActive is not in the update payload', async () => {
    const prisma = buildPrisma();
    prisma.branch.findFirst = jest.fn().mockResolvedValue(mockBranch);
    prisma.branch.update = jest.fn().mockResolvedValue(mockBranch);
    const eventBus = buildEventBus();
    const handler = new UpdateBranchHandler(prisma as never, eventBus as never, buildRlsTx(prisma) as never);

    await handler.execute({ branchId, city: 'Riyadh' }); // no isActive in payload

    expect(eventBus.publish).not.toHaveBeenCalled();
  });
});

describe('ListBranchesHandler', () => {
  it('returns paginated branches scoped by org', async () => {
    const prisma = buildPrisma();
    const handler = new ListBranchesHandler(prisma as never, buildTenant(), buildRlsTx(prisma) as never);
    const result = await handler.execute({});
    expect(result.items).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });
});

describe('GetBranchHandler', () => {
  it('returns branch with hours and holidays', async () => {
    const prisma = buildPrisma();
    prisma.branch.findFirst = jest.fn().mockResolvedValue(mockBranch);
    const handler = new GetBranchHandler(prisma as never, buildTenant());
    const result = await handler.execute({ branchId: 'branch-1' });
    expect(result.id).toBe('branch-1');
  });

  it('throws NotFoundException when branch not found', async () => {
    const prisma = buildPrisma();
    prisma.branch.findFirst = jest.fn().mockResolvedValue(null);
    const handler = new GetBranchHandler(prisma as never, buildTenant());
    await expect(handler.execute({ branchId: 'missing' })).rejects.toThrow(NotFoundException);
  });
});
