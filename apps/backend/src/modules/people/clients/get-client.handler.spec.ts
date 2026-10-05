import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { GetClientHandler } from './get-client.handler';

describe('GetClientHandler', () => {
  let handler: GetClientHandler;
  let prisma: { client: { findFirst: jest.Mock } };

  beforeEach(async () => {
    prisma = { client: { findFirst: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetClientHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get<GetClientHandler>(GetClientHandler);
  });

  it('throws NotFoundException when the client is missing or soft-deleted', async () => {
    prisma.client.findFirst.mockResolvedValue(null);

    await expect(
      handler.execute({ clientId: '00000000-0000-0000-0000-000000000001' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('excludes soft-deleted clients (deletedAt filter)', async () => {
    prisma.client.findFirst.mockResolvedValue(null);
    await expect(
      handler.execute({ clientId: '00000000-0000-0000-0000-000000000001' }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.client.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
  });

  it('returns the serialized client when found', async () => {
    prisma.client.findFirst.mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000001',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+966501234567',
      email: 'j@d.com',
      isActive: true,
      deletedAt: null,
    });

    const result = await handler.execute({ clientId: '00000000-0000-0000-0000-000000000001' });

    expect(result).toMatchObject({
      id: '00000000-0000-0000-0000-000000000001',
      firstName: 'John',
      lastName: 'Doe',
      isActive: true,
    });
  });
});

describe('GetClientHandler employee privacy', () => {
  const clientId = '00000000-0000-0000-0000-000000000001';
  function setup(related: boolean) {
    const prisma = {
      employee: { findFirst: jest.fn().mockResolvedValue({ id: 'employee-a' }) },
      booking: { findFirst: jest.fn().mockResolvedValue(related ? { id: 'booking-a' } : null) },
      client: { findFirst: jest.fn().mockResolvedValue({ id: clientId, name: 'Client', accountType: 'FULL', nationalId: 'secret', notes: 'private' }) },
    };
    return { prisma, handler: new GetClientHandler(prisma as any) };
  }
  it('denies a client with no booking relationship before returning private details', async () => {
    const { prisma, handler } = setup(false);
    await expect(handler.execute({ clientId, requesterRole: 'EMPLOYEE', requesterUserId: 'user-a' } as any)).rejects.toThrow(NotFoundException);
    expect(prisma.booking.findFirst).toHaveBeenCalledWith({ where: { employeeId: 'employee-a', clientId }, select: { id: true } });
  });
  it('returns only employee-safe fields for a related client, including ref lookups', async () => {
    const { handler } = setup(true);
    const out = await handler.execute({ clientId: 'CL-1', requesterRole: 'EMPLOYEE', requesterUserId: 'user-a' } as any);
    expect(out.id).toBe(clientId);
    expect(out).not.toHaveProperty('nationalId');
    expect(out).not.toHaveProperty('notes');
  });
  it('preserves privileged full client details', async () => {
    const { handler } = setup(false);
    expect(await handler.execute({ clientId, requesterRole: 'ADMIN', requesterUserId: 'admin' } as any)).toMatchObject({ nationalId: 'secret', notes: 'private' });
  });
  it('denies EMPLOYEE without a user id', async () => {
    const { prisma, handler } = setup(true);
    await expect(handler.execute({ clientId, requesterRole: 'EMPLOYEE' } as any)).rejects.toThrow();
    expect(prisma.client.findFirst).not.toHaveBeenCalled();
  });
});
