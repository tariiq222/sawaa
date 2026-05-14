import { ConflictException, NotFoundException } from '@nestjs/common';
import { OwnerProvisioningService } from './owner-provisioning.service';
import { PasswordService } from '../shared/password.service';

describe('OwnerProvisioningService', () => {
  // tx is a Prisma.TransactionClient subset; cast to any for mock ergonomics
  const tx = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  const passwordService = {
    hash: jest.fn().mockResolvedValue('hashed'),
  } as unknown as PasswordService;

  const service = new OwnerProvisioningService(passwordService);

  beforeEach(() => {
    jest.clearAllMocks();
    (passwordService.hash as jest.Mock).mockResolvedValue('hashed');
  });

  // ─── ID PATH ─────────────────────────────────────────────────────────────

  describe('existing user by id (happy path)', () => {
    it('returns userId + isNewUser:false without creating a user', async () => {
      tx.user.findUnique.mockResolvedValue({ id: 'uuid-1', isActive: true });

      const result = await service.provision({ ownerUserId: 'uuid-1', tx });

      expect(result).toEqual({ userId: 'uuid-1', isNewUser: false });
      expect(tx.user.create).not.toHaveBeenCalled();
      expect(passwordService.hash).not.toHaveBeenCalled();
    });
  });

  describe('existing user by id, inactive', () => {
    it('throws NotFoundException', async () => {
      tx.user.findUnique.mockResolvedValue({ id: 'uuid-2', isActive: false });

      await expect(
        service.provision({ ownerUserId: 'uuid-2', tx }),
      ).rejects.toThrow(new NotFoundException('owner_user_not_found'));
    });
  });

  describe('existing user by id, not found', () => {
    it('throws NotFoundException', async () => {
      tx.user.findUnique.mockResolvedValue(null);

      await expect(
        service.provision({ ownerUserId: 'uuid-3', tx }),
      ).rejects.toThrow(new NotFoundException('owner_user_not_found'));
    });
  });

  // ─── EMAIL PATH — existing user ──────────────────────────────────────────

  describe('existing user by email (auto-link)', () => {
    it('returns existing userId + isNewUser:false without creating a user', async () => {
      tx.user.findUnique.mockResolvedValue({ id: 'existing-id', isActive: true });

      const result = await service.provision({
        email: 'active@example.com',
        name: 'Active User',
        phone: '+966500000000',
        tx,
      });

      expect(result).toEqual({ userId: 'existing-id', isNewUser: false });
      expect(tx.user.create).not.toHaveBeenCalled();
    });
  });

  describe('existing user by email, inactive', () => {
    it('throws ConflictException', async () => {
      tx.user.findUnique.mockResolvedValue({ id: 'inactive-id', isActive: false });

      await expect(
        service.provision({
          email: 'inactive@example.com',
          name: 'Inactive User',
          phone: '+966500000001',
          tx,
        }),
      ).rejects.toThrow(
        new ConflictException('owner_email_belongs_to_inactive_user'),
      );
    });
  });

  // ─── EMAIL PATH — new user ───────────────────────────────────────────────

  describe('new user with provided password', () => {
    it('hashes the provided password, creates user, returns isNewUser:true without generatedPassword', async () => {
      tx.user.findUnique.mockResolvedValue(null);
      tx.user.create.mockResolvedValue({ id: 'new-id' });

      const result = await service.provision({
        email: 'new@example.com',
        name: 'New User',
        phone: '+966500000002',
        password: 'Test1234',
        tx,
      });

      expect(passwordService.hash).toHaveBeenCalledWith('Test1234');
      expect(tx.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'new@example.com',
            passwordHash: 'hashed',
          }),
        }),
      );
      expect(result).toEqual({
        userId: 'new-id',
        isNewUser: true,
        generatedPassword: undefined,
      });
    });
  });

  describe('new user with auto-generated password', () => {
    it('generates a password, returns it as generatedPassword with required character constraints', async () => {
      tx.user.findUnique.mockResolvedValue(null);
      tx.user.create.mockResolvedValue({ id: 'gen-id' });

      const result = await service.provision({
        email: 'gen@example.com',
        name: 'Gen User',
        phone: '+966500000003',
        // no password supplied — service generates one
        tx,
      });

      expect(result.isNewUser).toBe(true);
      expect(typeof result.generatedPassword).toBe('string');

      const pwd = result.generatedPassword as string;
      expect(pwd.length).toBeGreaterThanOrEqual(8);
      expect(/[A-Z]/.test(pwd)).toBe(true);
      expect(/\d/.test(pwd)).toBe(true);

      // hash was called with the generated password (not undefined)
      expect(passwordService.hash).toHaveBeenCalledWith(expect.any(String));
    });
  });

  describe('new user, password is whitespace', () => {
    it('treats whitespace-only password as empty and generates one', async () => {
      tx.user.findUnique.mockResolvedValue(null);
      tx.user.create.mockResolvedValue({ id: 'ws-id' });

      const result = await service.provision({
        email: 'ws@example.com',
        name: 'WS User',
        phone: '+966500000004',
        password: '   ',
        tx,
      });

      expect(result.isNewUser).toBe(true);
      expect(typeof result.generatedPassword).toBe('string');
      expect((result.generatedPassword as string).trim().length).toBeGreaterThan(0);
    });
  });

  // ─── VALIDATION ERRORS ───────────────────────────────────────────────────

  describe('neither id nor email', () => {
    it('throws ConflictException when no ownerUserId or email is provided', async () => {
      await expect(
        service.provision({ tx }),
      ).rejects.toThrow(new ConflictException('owner_id_or_email_required'));
    });
  });

  describe('email path missing name or phone', () => {
    it('throws ConflictException when email not found and name/phone absent', async () => {
      tx.user.findUnique.mockResolvedValue(null); // no existing user for this email

      await expect(
        service.provision({ email: 'noname@example.com', tx }),
      ).rejects.toThrow(new ConflictException('owner_name_and_phone_required'));
    });
  });
});
