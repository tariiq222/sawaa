import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { GetUserHandler } from './get-user.handler';

describe('GetUserHandler', () => {
  let handler: GetUserHandler;
  let prisma: { user: { findUnique: jest.Mock } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetUserHandler,
        { provide: PrismaService, useValue: { user: { findUnique: jest.fn() } } },
      ],
    }).compile();

    handler = module.get<GetUserHandler>(GetUserHandler);
    prisma = module.get<PrismaService>(PrismaService) as any;
  });

  it('resolves with the user when found by UUID', async () => {
    const user = { id: '00000000-0000-0000-0000-000000000001', name: 'X' };
    prisma.user.findUnique.mockResolvedValue(user);
    await expect(
      handler.execute({ userId: '00000000-0000-0000-0000-000000000001' }),
    ).resolves.toEqual(user);
  });

  it('passes `{ id }` as the where clause for a UUID-format userId', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    await handler.execute({ userId: '00000000-0000-0000-0000-000000000001' });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: '00000000-0000-0000-0000-000000000001' },
      omit: { passwordHash: true },
    });
  });

  it('passes `{ ref }` as the where clause for a USR-prefixed reference id', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', ref: 42 });
    await handler.execute({ userId: 'USR-42' });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { ref: 42 },
      omit: { passwordHash: true },
    });
  });

  it('matches the USR- prefix case-insensitively (usr-99 → { ref: 99 })', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', ref: 99 });
    await handler.execute({ userId: 'usr-99' });
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ref: 99 } }),
    );
  });

  it('omits passwordHash from the response (PII guard)', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    await handler.execute({ userId: '00000000-0000-0000-0000-000000000001' });
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ omit: { passwordHash: true } }),
    );
  });

  it('throws NotFoundException when the user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      handler.execute({ userId: '00000000-0000-0000-0000-000000000099' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException for a value that is neither UUID nor USR-<n>', async () => {
    await expect(handler.execute({ userId: 'not-a-real-id' })).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('throws BadRequestException for the wrong prefix (CLI-42 instead of USR-42)', async () => {
    await expect(handler.execute({ userId: 'CLI-42' })).rejects.toThrow(BadRequestException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
