import { RunOrphanAuditHandler } from './run-orphan-audit.handler';
import { ActivityAction } from '@prisma/client';

/**
 * We mock Prisma at the level of the dynamic model accessor.
 * The handler accesses models via prisma.$allTenants[model].
 * ClsService is mocked to call the callback immediately (no real CLS context needed).
 */
const buildClsMock = () => ({
  run: jest.fn().mockImplementation((fn: () => Promise<void>) => fn()),
  set: jest.fn(),
});

const buildPrismaProxy = (
  orgs: Array<{ id: string }>,
  orphanIds: string[],
  parentExists: boolean,
) => {
  const activityLogCreate = jest.fn().mockResolvedValue(undefined);
  // Return objects with id + a stubbed cross-BC field (clientId/employeeId/etc.)
  const findMany = jest.fn().mockResolvedValue(
    orphanIds.map((id) => ({ id, clientId: id, employeeId: id, serviceId: id, branchId: id })),
  );
  const parentFindFirst = jest
    .fn()
    .mockResolvedValue(parentExists ? { id: orphanIds[0] } : null);

  const baseProxy = new Proxy(
    {
      organization: { findMany: jest.fn().mockResolvedValue(orgs) },
      activityLog: { create: activityLogCreate },
    },
    {
      get(target, prop: string) {
        if (prop in target) return target[prop as keyof typeof target];
        // Any other model access (booking, client, invoice, etc.)
        return { findMany, findFirst: parentFindFirst };
      },
    },
  );

  const prisma = {
    get $allTenants() {
      return baseProxy;
    },
  };

  return { prisma, activityLogCreate, findMany, parentFindFirst };
};

describe('RunOrphanAuditHandler', () => {
  it('writes an ActivityLog entry for each orphaned row', async () => {
    const orgs = [{ id: 'org-1' }];
    const { prisma, activityLogCreate } = buildPrismaProxy(orgs, ['booking-x'], false);
    const cls = buildClsMock();

    const handler = new RunOrphanAuditHandler(prisma as never, cls as never);
    await handler.execute();

    // At least one orphan_audit log entry per orphan detected
    expect(activityLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          action: ActivityAction.SYSTEM,
          entity: 'orphan_audit',
        }),
      }),
    );
  });

  it('does NOT write ActivityLog when no orphans are found', async () => {
    const orgs = [{ id: 'org-2' }];
    const { prisma, activityLogCreate } = buildPrismaProxy(
      orgs,
      [], // no children → no orphan candidates
      false,
    );
    const cls = buildClsMock();

    const handler = new RunOrphanAuditHandler(prisma as never, cls as never);
    await handler.execute();

    expect(activityLogCreate).not.toHaveBeenCalled();
  });

  it('scopes detection to each org separately (tenant isolation)', async () => {
    const orgs = [{ id: 'org-A' }, { id: 'org-B' }];
    const { prisma, activityLogCreate } = buildPrismaProxy(orgs, ['child-id-1'], false);
    const cls = buildClsMock();

    const handler = new RunOrphanAuditHandler(prisma as never, cls as never);
    await handler.execute();

    // Every ActivityLog write must include organizationId from one of the orgs
    for (const call of activityLogCreate.mock.calls) {
      const data = (call[0] as { data: { organizationId: string } }).data;
      expect(['org-A', 'org-B']).toContain(data.organizationId);
    }
  });

  it('uses a super-admin CLS context for cross-tenant access', async () => {
    const orgs = [{ id: 'org-1' }];
    const { prisma } = buildPrismaProxy(orgs, [], false);
    const cls = buildClsMock();

    const handler = new RunOrphanAuditHandler(prisma as never, cls as never);
    await handler.execute();

    expect(cls.run).toHaveBeenCalledTimes(1);
    expect(cls.set).toHaveBeenCalledWith(expect.any(String), true);
  });
});
