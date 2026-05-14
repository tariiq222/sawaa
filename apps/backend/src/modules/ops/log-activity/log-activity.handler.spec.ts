import { LogActivityHandler } from './log-activity.handler';
import { ActivityAction } from '@prisma/client';

const buildTenant = (organizationId = 'org-A') => ({
  requireOrganizationIdOrDefault: jest.fn().mockReturnValue(organizationId),
});

const buildPrisma = () => ({
  activityLog: { create: jest.fn().mockResolvedValue({ id: 'log-1' }) },
});

describe('LogActivityHandler', () => {
  it('creates an activity log entry', async () => {
    const prisma = buildPrisma();
    const handler = new LogActivityHandler(prisma as never, buildTenant() as never);

    await handler.execute({
      action: ActivityAction.CREATE,
      entity: 'Booking',
      entityId: 'book-1',
      description: 'Created booking',
    });

    expect(prisma.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: ActivityAction.CREATE,
          entity: 'Booking',
          description: 'Created booking',
        }),
      }),
    );
  });

  it('stores optional metadata as JSON', async () => {
    const prisma = buildPrisma();
    const handler = new LogActivityHandler(prisma as never, buildTenant() as never);

    await handler.execute({
      action: ActivityAction.UPDATE,
      entity: 'Employee',
      description: 'Updated availability',
      metadata: { changedFields: ['slots'] },
    });

    expect(prisma.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ metadata: { changedFields: ['slots'] } }),
      }),
    );
  });

  it('stores ipAddress and userAgent when provided', async () => {
    const prisma = buildPrisma();
    const handler = new LogActivityHandler(prisma as never, buildTenant() as never);

    await handler.execute({
      action: ActivityAction.LOGIN,
      entity: 'User',
      description: 'User logged in',
      ipAddress: '1.2.3.4',
      userAgent: 'Mozilla',
    });

    expect(prisma.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ipAddress: '1.2.3.4', userAgent: 'Mozilla' }),
      }),
    );
  });
});
