import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { GetMeHandler } from './get-me.handler';

describe('GetMeHandler', () => {
  let handler: GetMeHandler;
  let prisma: { client: { findFirst: jest.Mock } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetMeHandler,
        { provide: PrismaService, useValue: { client: { findFirst: jest.fn() } } },
      ],
    }).compile();
    handler = module.get<GetMeHandler>(GetMeHandler);
    prisma = module.get<PrismaService>(PrismaService) as any;
  });

  it('returns the public client profile when found', async () => {
    const client = {
      id: 'c1',
      name: 'Salem',
      email: 'salem@example.com',
      phone: '+966512345678',
      emailVerified: new Date('2026-01-01'),
      phoneVerified: new Date('2026-01-02'),
      accountType: 'OTP',
      claimedAt: new Date('2026-01-03'),
      createdAt: new Date('2026-01-04'),
    };
    prisma.client.findFirst.mockResolvedValue(client);

    await expect(handler.execute('c1')).resolves.toEqual(client);
  });

  it('queries with deletedAt: null so soft-deleted clients are excluded', async () => {
    prisma.client.findFirst.mockResolvedValue({ id: 'c1' });
    await handler.execute('c1');
    expect(prisma.client.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'c1', deletedAt: null }) }),
    );
  });

  it('selects ONLY the public profile fields (no password / internal fields leak)', async () => {
    prisma.client.findFirst.mockResolvedValue({ id: 'c1' });
    await handler.execute('c1');

    const call = prisma.client.findFirst.mock.calls[0][0];
    const selected = Object.keys(call.select).sort();
    // Public profile — see the ClientProfile interface in the handler.
    expect(selected).toEqual(
      [
        'accountType',
        'claimedAt',
        'createdAt',
        'email',
        'emailVerified',
        'id',
        'name',
        'phone',
        'phoneVerified',
      ].sort(),
    );
  });

  it('throws NotFoundException when the client does not exist (or is soft-deleted)', async () => {
    prisma.client.findFirst.mockResolvedValue(null);
    await expect(handler.execute('ghost')).rejects.toThrow(NotFoundException);
  });

  it('propagates Prisma errors', async () => {
    prisma.client.findFirst.mockRejectedValue(new Error('DB down'));
    await expect(handler.execute('c1')).rejects.toThrow('DB down');
  });
});
