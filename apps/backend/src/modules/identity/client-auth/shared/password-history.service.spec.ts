import { BadRequestException } from '@nestjs/common';
import { PasswordHistoryService, PASSWORD_HISTORY_DEPTH } from './password-history.service';
import { PasswordService } from '../../shared/password.service';

type PrismaMock = {
  passwordHistory: {
    findMany: jest.Mock;
    create: jest.Mock;
    deleteMany: jest.Mock;
  };
};

const buildPrisma = (): PrismaMock => ({
  passwordHistory: {
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
});

describe('PasswordHistoryService', () => {
  const passwords = new PasswordService();

  describe('assertNotReused', () => {
    it('passes when current hash is null and history is empty', async () => {
      const prisma = buildPrisma();
      const svc = new PasswordHistoryService(prisma as never, passwords);
      await expect(
        svc.assertNotReused('c1', 'o1', 'NewPass123', null),
      ).resolves.toBeUndefined();
    });

    it('rejects when new password matches current hash', async () => {
      const prisma = buildPrisma();
      const svc = new PasswordHistoryService(prisma as never, passwords);
      const currentHash = await passwords.hash('OldPass123');
      await expect(
        svc.assertNotReused('c1', 'o1', 'OldPass123', currentHash),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when new password matches a row in history', async () => {
      const prisma = buildPrisma();
      const reusedHash = await passwords.hash('ReusedPass1');
      prisma.passwordHistory.findMany.mockResolvedValue([
        { passwordHash: await passwords.hash('other') },
        { passwordHash: reusedHash },
      ]);
      const svc = new PasswordHistoryService(prisma as never, passwords);
      await expect(
        svc.assertNotReused('c1', 'o1', 'ReusedPass1', null),
      ).rejects.toThrow(BadRequestException);
    });

    it('passes when new password does not match current or history', async () => {
      const prisma = buildPrisma();
      const currentHash = await passwords.hash('OldPass123');
      prisma.passwordHistory.findMany.mockResolvedValue([
        { passwordHash: await passwords.hash('older1') },
      ]);
      const svc = new PasswordHistoryService(prisma as never, passwords);
      await expect(
        svc.assertNotReused('c1', 'o1', 'BrandNewPass1', currentHash),
      ).resolves.toBeUndefined();
    });

    it('queries at most HISTORY_DEPTH rows', async () => {
      const prisma = buildPrisma();
      const svc = new PasswordHistoryService(prisma as never, passwords);
      await svc.assertNotReused('c1', 'o1', 'NewPass', null);
      expect(prisma.passwordHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: PASSWORD_HISTORY_DEPTH }),
      );
    });
  });

  describe('record', () => {
    it('inserts new row and trims beyond HISTORY_DEPTH', async () => {
      const prisma = buildPrisma();
      prisma.passwordHistory.findMany.mockResolvedValue([{ id: 'surplus-1' }, { id: 'surplus-2' }]);
      const svc = new PasswordHistoryService(prisma as never, passwords);
      await svc.record(prisma as never, 'c1', 'o1', 'hash-new');
      expect(prisma.passwordHistory.create).toHaveBeenCalledWith({
        data: { clientId: 'c1', organizationId: 'o1', passwordHash: 'hash-new' },
      });
      expect(prisma.passwordHistory.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['surplus-1', 'surplus-2'] } },
      });
    });

    it('skips deleteMany when under HISTORY_DEPTH', async () => {
      const prisma = buildPrisma();
      prisma.passwordHistory.findMany.mockResolvedValue([]);
      const svc = new PasswordHistoryService(prisma as never, passwords);
      await svc.record(prisma as never, 'c1', 'o1', 'hash-new');
      expect(prisma.passwordHistory.deleteMany).not.toHaveBeenCalled();
    });
  });
});
