import { ListWaitlistHandler } from './list-waitlist.handler';
import { buildPrisma } from '../testing/booking-test-helpers';

describe('ListWaitlistHandler', () => {
  it('lists all waitlist entries enriched with client/employee/service', async () => {
    const prisma = buildPrisma();
    const entries = [
      {
        id: 'wl-1',
        status: 'WAITING',
        clientId: 'client-1',
        employeeId: 'emp-1',
        serviceId: 'svc-1',
      },
    ];
    prisma.waitlistEntry.findMany = jest.fn().mockResolvedValue(entries);
    const client = { id: 'client-1', name: 'Client One', phone: '0500000000' };
    const employee = { id: 'emp-1', name: 'Employee One' };
    const service = { id: 'svc-1', nameAr: 'خدمة', nameEn: 'Service' };
    prisma.client.findMany = jest.fn().mockResolvedValue([client]);
    prisma.employee.findMany = jest.fn().mockResolvedValue([employee]);
    prisma.service.findMany = jest.fn().mockResolvedValue([service]);

    const result = await new ListWaitlistHandler(prisma as never).execute({});

    expect(result).toEqual([{ ...entries[0], client, employee, service }]);
    expect(prisma.waitlistEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
    expect(prisma.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['client-1'] } },
      }),
    );
    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['emp-1'] } },
      }),
    );
    expect(prisma.service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['svc-1'] } },
      }),
    );
  });

  it('sets a relation to null when its batched lookup returns no match', async () => {
    const prisma = buildPrisma();
    const entries = [
      {
        id: 'wl-1',
        status: 'WAITING',
        clientId: 'client-1',
        employeeId: 'emp-1',
        serviceId: 'svc-missing',
      },
    ];
    prisma.waitlistEntry.findMany = jest.fn().mockResolvedValue(entries);
    const client = { id: 'client-1', name: 'Client One', phone: '0500000000' };
    const employee = { id: 'emp-1', name: 'Employee One' };
    prisma.client.findMany = jest.fn().mockResolvedValue([client]);
    prisma.employee.findMany = jest.fn().mockResolvedValue([employee]);
    prisma.service.findMany = jest.fn().mockResolvedValue([]);

    const result = await new ListWaitlistHandler(prisma as never).execute({});

    expect(result).toEqual([{ ...entries[0], client, employee, service: null }]);
  });

  it('returns an empty array without enrichment lookups when there are no entries', async () => {
    const prisma = buildPrisma();
    prisma.waitlistEntry.findMany = jest.fn().mockResolvedValue([]);
    prisma.client.findMany = jest.fn();
    prisma.employee.findMany = jest.fn();
    prisma.service.findMany = jest.fn();

    const result = await new ListWaitlistHandler(prisma as never).execute({});

    expect(result).toEqual([]);
    expect(prisma.client.findMany).not.toHaveBeenCalled();
    expect(prisma.employee.findMany).not.toHaveBeenCalled();
    expect(prisma.service.findMany).not.toHaveBeenCalled();
  });

  it('filters by employeeId and status when provided', async () => {
    const prisma = buildPrisma();
    prisma.waitlistEntry.findMany = jest.fn().mockResolvedValue([]);
    await new ListWaitlistHandler(prisma as never).execute({
      employeeId: 'emp-1',
      status: 'WAITING',
    });
    expect(prisma.waitlistEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { employeeId: 'emp-1', status: 'WAITING' },
      }),
    );
  });
});
