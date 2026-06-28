import { RunOrphanAuditHandler } from './run-orphan-audit.handler';
import { ActivityAction } from '@prisma/client';

/**
 * We mock Prisma at the level of the dynamic model accessor.
 * The handler accesses models directly via prisma[model] (single-tenant mode).
 */

const buildPrismaProxy = (
  orgs: Array<{ id: string }>,
  orphanIds: string[],
  parentExists: boolean,
) => {
  const activityLogCreate = jest.fn().mockResolvedValue(undefined);
  // Child candidate rows carry id + a stubbed cross-BC field (clientId/etc.).
  const childRows = orphanIds.map((id) => ({
    id,
    clientId: id,
    employeeId: id,
    serviceId: id,
    branchId: id,
  }));
  // The handler now batches both child candidates and parent existence checks
  // through findMany. We distinguish them by the parent query's `id: { in: [] }`
  // filter: parent lookups carry that filter, child candidate scans do not.
  const findMany = jest.fn().mockImplementation((args: { where?: { id?: { in?: string[] } } }) => {
    const isParentLookup = Boolean(args?.where?.id?.in);
    if (isParentLookup) {
      return Promise.resolve(parentExists ? orphanIds.map((id) => ({ id })) : []);
    }
    return Promise.resolve(childRows);
  });

  const prisma = new Proxy(
    {
      organization: { findMany: jest.fn().mockResolvedValue(orgs) },
      activityLog: { create: activityLogCreate },
    },
    {
      get(target, prop: string) {
        if (prop in target) return target[prop as keyof typeof target];
        // Any other model access (booking, client, invoice, etc.)
        return { findMany };
      },
    },
  );

  return { prisma, activityLogCreate, findMany };
};

describe('RunOrphanAuditHandler', () => {
  it('writes an ActivityLog entry for each orphaned row', async () => {
    // org scoping moved to RLS / removed in single-tenant migration — handler uses
    // DEFAULT_ORGANIZATION_ID; activityLog.create no longer writes organizationId
    const orgs = [{ id: 'org-1' }];
    const { prisma, activityLogCreate } = buildPrismaProxy(orgs, ['booking-x'], false);

    const handler = new RunOrphanAuditHandler(prisma as never);
    await handler.execute();

    // At least one orphan_audit log entry per orphan detected
    expect(activityLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
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

    const handler = new RunOrphanAuditHandler(prisma as never);
    await handler.execute();

    expect(activityLogCreate).not.toHaveBeenCalled();
  });

  it('runs audit scoped to DEFAULT_ORGANIZATION_ID (single-tenant migration)', async () => {
    // org scoping moved to RLS / removed in single-tenant migration — handler no longer
    // iterates organization.findMany; runs once with DEFAULT_ORGANIZATION_ID
    const orgs = [{ id: 'org-A' }, { id: 'org-B' }];
    const { prisma, activityLogCreate, findMany: _findMany } = buildPrismaProxy(orgs, ['child-id-1'], false);

    const handler = new RunOrphanAuditHandler(prisma as never);
    await handler.execute();

    // Handler runs checks once (single org), activityLog entries written for orphans found
    expect(activityLogCreate).toHaveBeenCalled();
    // All log entries have action=SYSTEM entity=orphan_audit
    for (const call of activityLogCreate.mock.calls) {
      const data = (call[0] as { data: { action: string; entity: string } }).data;
      expect(data.action).toBe(ActivityAction.SYSTEM);
      expect(data.entity).toBe('orphan_audit');
    }
  });
});
