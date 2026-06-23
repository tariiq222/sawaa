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