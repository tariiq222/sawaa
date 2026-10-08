import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { OtpPurpose, OtpChannel } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { OtpSessionService } from '../../otp/otp-session.service';
import { PasswordService } from '../../shared/password.service';
import { PasswordHistoryService } from '../shared/password-history.service';
import { ResetPasswordHandler } from './reset-password.handler';

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
}));

describe('ResetPasswordHandler', () => {
  let handler: ResetPasswordHandler;
  let prisma: any;
  let otpSession: any;
  let passwords: any;
  let passwordHistory: any;

  function setClient(client: Record<string, unknown> | null) {
    if (client) {
      for (const [key, value] of Object.entries({ isActive: true, deletedAt: null, userId: null, email: 'a@b.com', phone: '+966501234567' })) {
        if (!(key in client)) client[key] = value;
      }
    }
    prisma.client.findFirst.mockResolvedValue(client);
    prisma.client.findUnique.mockResolvedValue(client);
    prisma.client.findMany.mockResolvedValue(client ? [client] : []);
  }

  beforeEach(async () => {
    prisma = {
      client: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn(async (cb) => await cb(prisma)),
      usedOtpSession: { create: jest.fn() },
      clientRefreshToken: { updateMany: jest.fn() },
    };
    otpSession = { verifySession: jest.fn() };
    passwords = { hash: jest.fn() };
    passwordHistory = { assertNotReused: jest.fn(), record: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        ResetPasswordHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: RlsTransactionService, useValue: { withTransaction: jest.fn((cb: any) => cb(prisma)) } },
        { provide: OtpSessionService, useValue: otpSession },
        { provide: PasswordService, useValue: passwords },
        { provide: PasswordHistoryService, useValue: passwordHistory },
      ],
    }).compile();

    handler = module.get(ResetPasswordHandler);
  });

  it('should be defined', () => expect(handler).toBeDefined());

  it('should throw when session is null', async () => {
    otpSession.verifySession.mockReturnValue(null);
    await expect(handler.execute({ sessionToken: 't', newPassword: 'p' })).rejects.toThrow(UnauthorizedException);
  });

  it('should throw when purpose mismatch', async () => {
    otpSession.verifySession.mockReturnValue({ purpose: OtpPurpose.CLIENT_LOGIN });
    await expect(handler.execute({ sessionToken: 't', newPassword: 'p' })).rejects.toThrow(UnauthorizedException);
  });

  it('should throw when client not found for email', async () => {
    otpSession.verifySession.mockReturnValue({ purpose: OtpPurpose.CLIENT_PASSWORD_RESET, channel: OtpChannel.EMAIL, identifier: 'a@b.com', jti: 'j1' });
    setClient(null);
    await expect(handler.execute({ sessionToken: 't', newPassword: 'p' })).rejects.toThrow(UnauthorizedException);
  });

  it('should throw when client not found for phone', async () => {
    otpSession.verifySession.mockReturnValue({ purpose: OtpPurpose.CLIENT_PASSWORD_RESET, channel: OtpChannel.SMS, identifier: '+966501234567', jti: 'j1' });
    setClient(null);
    await expect(handler.execute({ sessionToken: 't', newPassword: 'p' })).rejects.toThrow(UnauthorizedException);
  });

  it('should throw when session already used', async () => {
    otpSession.verifySession.mockReturnValue({ purpose: OtpPurpose.CLIENT_PASSWORD_RESET, channel: OtpChannel.EMAIL, identifier: 'a@b.com', jti: 'j1', exp: Math.floor(Date.now() / 1000) + 3600 });
    setClient({ id: 'c1', passwordHash: 'old' });
    prisma.usedOtpSession.create.mockRejectedValue(new Error('dup'));
    await expect(handler.execute({ sessionToken: 't', newPassword: 'p' })).rejects.toThrow(UnauthorizedException);
  });

  it('should complete reset for email channel', async () => {
    const session = { purpose: OtpPurpose.CLIENT_PASSWORD_RESET, channel: OtpChannel.EMAIL, identifier: 'a@b.com', jti: 'j1', exp: Math.floor(Date.now() / 1000) + 3600 };
    otpSession.verifySession.mockReturnValue(session);
    setClient({ id: 'c1', passwordHash: 'old' });
    passwords.hash.mockResolvedValue('newHash');
    prisma.usedOtpSession.create.mockResolvedValue({});
    prisma.client.update.mockResolvedValue({});
    prisma.clientRefreshToken.updateMany.mockResolvedValue({ count: 2 });

    await handler.execute({ sessionToken: 't', newPassword: 'p' });
    expect(passwordHistory.assertNotReused).toHaveBeenCalledWith('c1', expect.any(String), 'p', 'old');
    expect(passwords.hash).toHaveBeenCalledWith('p');
    expect(prisma.client.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { passwordHash: 'newHash', emailVerified: expect.any(Date), loginAttempts: 0, lockoutUntil: null, tokenVersion: { increment: 1 } } });
    expect(passwordHistory.record).toHaveBeenCalledWith(prisma, 'c1', expect.any(String), 'newHash');
    expect(prisma.clientRefreshToken.updateMany).toHaveBeenCalledWith({ where: { clientId: 'c1', revokedAt: null }, data: { revokedAt: expect.any(Date) } });
  });

  it('should complete reset for phone channel', async () => {
    const session = { purpose: OtpPurpose.CLIENT_PASSWORD_RESET, channel: OtpChannel.SMS, identifier: '+966501234567', jti: 'j1' };
    otpSession.verifySession.mockReturnValue(session);
    setClient({ id: 'c2', passwordHash: null });
    passwords.hash.mockResolvedValue('newHash');
    prisma.usedOtpSession.create.mockResolvedValue({});
    prisma.client.update.mockResolvedValue({});
    prisma.clientRefreshToken.updateMany.mockResolvedValue({ count: 1 });

    await handler.execute({ sessionToken: 't', newPassword: 'p' });
    expect(prisma.client.findFirst).toHaveBeenCalledWith({ where: { phone: '+966501234567', deletedAt: null } });
  });

  it.each([
    { channel: OtpChannel.EMAIL, identifier: 'a@b.com', verifiedField: 'emailVerified', untouchedField: 'phoneVerified' },
    { channel: OtpChannel.SMS, identifier: '+966501234567', verifiedField: 'phoneVerified', untouchedField: 'emailVerified' },
  ])('creates a password and verifies only the proven $channel identity; replay cannot write again', async ({ channel, identifier, verifiedField, untouchedField }) => {
    const client: Record<string, unknown> = {
      id: 'passwordless-client', email: 'a@b.com', phone: '+966501234567',
      passwordHash: null, emailVerified: null, phoneVerified: null,
      tokenVersion: 3, loginAttempts: 2, lockoutUntil: new Date(),
    };
    otpSession.verifySession.mockReturnValue({
      purpose: OtpPurpose.CLIENT_PASSWORD_RESET, channel, identifier, jti: 'single-use-reset',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    setClient(client);
    passwords.hash.mockResolvedValue('created-password-hash');
    prisma.usedOtpSession.create.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('duplicate jti'));
    prisma.client.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      Object.assign(client, data, { tokenVersion: (client.tokenVersion as number) + 1 });
      return client;
    });
    prisma.clientRefreshToken.updateMany.mockResolvedValue({ count: 1 });

    const before = Date.now();
    await handler.execute({ sessionToken: 'proof', newPassword: 'NewPassword123' });
    expect(client.passwordHash).toBe('created-password-hash');
    expect(client[verifiedField]).toBeInstanceOf(Date);
    expect((client[verifiedField] as Date).getTime()).toBeGreaterThanOrEqual(before);
    expect(client[untouchedField]).toBeNull();
    expect(client.tokenVersion).toBe(4);
    expect(client.loginAttempts).toBe(0);
    expect(client.lockoutUntil).toBeNull();
    expect(passwordHistory.assertNotReused).toHaveBeenNthCalledWith(1, 'passwordless-client', expect.any(String), 'NewPassword123', null);

    await expect(handler.execute({ sessionToken: 'proof', newPassword: 'AnotherPassword123' })).rejects.toThrow('Session already used');
    expect(prisma.client.update).toHaveBeenCalledTimes(1);
    expect(passwordHistory.record).toHaveBeenCalledTimes(1);
    expect(prisma.clientRefreshToken.updateMany).toHaveBeenCalledTimes(1);
  });

  it('rejects a phone changed while password hashing is pending without stamping the new phone', async () => {
    const client = { id: 'c1', phone: '+966501234567', passwordHash: null, phoneVerified: null };
    setClient(client);
    otpSession.verifySession.mockReturnValue({ purpose: OtpPurpose.CLIENT_PASSWORD_RESET, channel: OtpChannel.SMS,
      identifier: '+966501234567', jti: 'phone-race', exp: Math.floor(Date.now() / 1000) + 3600 });
    let releaseHash!: () => void;
    let hashStarted!: () => void;
    const started = new Promise<void>(resolve => { hashStarted = resolve; });
    const paused = new Promise<void>(resolve => { releaseHash = resolve; });
    passwords.hash.mockImplementation(async () => { hashStarted(); await paused; return 'newHash'; });
    const result = handler.execute({ sessionToken: 'proof', newPassword: 'NewPassword123' });
    await started;
    const changedClient = { ...client, phone: '+966509999999' };
    setClient(changedClient);
    releaseHash();
    await expect(result).rejects.toThrow(UnauthorizedException);
    expect(prisma.client.update).not.toHaveBeenCalled();
    expect(changedClient.phoneVerified).toBeNull();
    expect(changedClient.passwordHash).toBeNull();
    expect(prisma.usedOtpSession.create).not.toHaveBeenCalled();
  });

  it('bumps tokenVersion in the same client update that sets the new passwordHash', async () => {
    const session = { purpose: OtpPurpose.CLIENT_PASSWORD_RESET, channel: OtpChannel.EMAIL, identifier: 'a@b.com', jti: 'j1', exp: Math.floor(Date.now() / 1000) + 3600 };
    otpSession.verifySession.mockReturnValue(session);
    setClient({ id: 'c1', passwordHash: 'old' });
    passwords.hash.mockResolvedValue('newHash');
    prisma.usedOtpSession.create.mockResolvedValue({});
    prisma.client.update.mockResolvedValue({});
    prisma.clientRefreshToken.updateMany.mockResolvedValue({ count: 0 });

    await handler.execute({ sessionToken: 't', newPassword: 'p' });
    const updateArg = prisma.client.update.mock.calls[0][0];
    expect(updateArg.data.passwordHash).toBe('newHash');
    expect(updateArg.data.tokenVersion).toEqual({ increment: 1 });
  });
});

describe('ResetPasswordHandler email identity resolution', () => {
  let clients: any[];
  let users: any[];
  let handler: ResetPasswordHandler;
  let update: jest.Mock;
  let hashPassword: jest.Mock;
  const verified = new Date('2026-01-01');
  const matches = (row: any, where: any): boolean => Object.entries(where).every(([key, value]: [string, any]) => {
    if (key === 'OR') return value.some((entry: any) => matches(row, entry));
    if (value && typeof value === 'object' && 'in' in value) return value.in.includes(row[key]);
    if (value && typeof value === 'object' && 'equals' in value) return row[key]?.toLowerCase() === value.equals.toLowerCase();
    return row[key] === value;
  });

  beforeEach(() => {
    users = [{ id: 'u1', email: 'Customer@Example.com', phone: '+966501234567', role: 'CLIENT',
      isSuperAdmin: false, isActive: true, emailVerifiedAt: verified }];
    clients = [{ id: 'c1', userId: 'u1', email: null, phone: '+966501234567', passwordHash: null,
      isActive: true, deletedAt: null, emailVerified: null, phoneVerified: verified, tokenVersion: 2 }];
    update = jest.fn(async ({ where, data }) => {
      const client = clients.find(row => matches(row, where));
      Object.assign(client, data);
      return client;
    });
    const prisma = {
      client: {
        findFirst: async ({ where }: any) => clients.find(row => matches(row, where)) ?? null,
        findUnique: async ({ where }: any) => clients.find(row => matches(row, where)) ?? null,
        findMany: async ({ where }: any) => clients.filter(row => matches(row, where)),
        update,
      },
      user: {
        findMany: async ({ where }: any) => users.filter(row => matches(row, where)),
        findUnique: async ({ where }: any) => users.find(row => matches(row, where)) ?? null,
      },
      $queryRaw: async () => [],
      usedOtpSession: { create: async () => ({}) },
      clientRefreshToken: { updateMany: async () => ({ count: 1 }) },
    };
    hashPassword = jest.fn().mockResolvedValue('new-password-hash');
    handler = new ResetPasswordHandler(prisma as any, { withTransaction: (callback: any) => callback(prisma) } as any,
      { verifySession: () => ({ purpose: OtpPurpose.CLIENT_PASSWORD_RESET, channel: OtpChannel.EMAIL,
        identifier: 'customer@example.com', jti: 'email-proof', exp: Math.floor(Date.now() / 1000) + 3600 }) } as any,
      { hash: hashPassword } as any,
      { assertNotReused: async () => undefined, record: async () => undefined } as any);
  });

  it('uses the already verified User email without attaching or verifying a null Client email', async () => {
    await handler.execute({ sessionToken: 'email-proof', newPassword: 'NewPassword123' });
    expect(clients[0].passwordHash).toBe('new-password-hash');
    expect(clients[0].email).toBeNull();
    expect(clients[0].emailVerified).toBeNull();
    expect(clients[0].phoneVerified).toEqual(verified);
    expect(users[0].emailVerifiedAt).toEqual(verified);
  });

  it('matches a standalone mixed-case Client email and stamps only email verification', async () => {
    users = [];
    clients[0].userId = null;
    clients[0].email = 'Customer@Example.com';
    await handler.execute({ sessionToken: 'email-proof', newPassword: 'NewPassword123' });
    expect(clients[0].passwordHash).toBe('new-password-hash');
    expect(clients[0].email).toBe('Customer@Example.com');
    expect(clients[0].emailVerified).toBeInstanceOf(Date);
    expect(clients[0].phoneVerified).toEqual(verified);
  });

  it.each([
    ['Client email', () => { clients[0] = { ...clients[0], email: 'changed@example.com' }; }],
    ['User alias', () => { users[0] = { ...users[0], email: 'changed@example.com' }; }],
    ['User role', () => { users[0] = { ...users[0], role: 'ADMIN' }; }],
    ['User link', () => { clients[0] = { ...clients[0], userId: 'another-user' }; }],
  ] as const)('rejects %s changed during password hashing', async (_name, mutate) => {
    let releaseHash!: () => void;
    let hashStarted!: () => void;
    const started = new Promise<void>(resolve => { hashStarted = resolve; });
    const paused = new Promise<void>(resolve => { releaseHash = resolve; });
    hashPassword.mockImplementation(async () => { hashStarted(); await paused; return 'newHash'; });
    const result = handler.execute({ sessionToken: 'email-proof', newPassword: 'NewPassword123' });
    await started;
    mutate();
    releaseHash();
    await expect(result).rejects.toThrow(UnauthorizedException);
    expect(update).not.toHaveBeenCalled();
    expect(clients[0].emailVerified).toBeNull();
    expect(clients[0].passwordHash).toBeNull();
  });

  it.each([
    ['unverified User email', () => { users[0].emailVerifiedAt = null; }],
    ['inactive User', () => { users[0].isActive = false; }],
    ['staff User', () => { users[0].role = 'ADMIN'; }],
    ['superadmin User', () => { users[0].isSuperAdmin = true; }],
    ['inactive Client', () => { clients[0].isActive = false; }],
    ['deleted Client', () => { clients[0].deletedAt = verified; }],
    ['mismatched email', () => { clients[0].email = 'another@example.com'; }],
    ['mismatched phone', () => { clients[0].phone = '+966509999999'; }],
    ['duplicate User', () => { users.push({ ...users[0], id: 'u2' }); }],
    ['multiple linked Clients', () => { clients.push({ ...clients[0], id: 'c2' }); }],
    ['conflicting standalone Client', () => { clients.push({ ...clients[0], id: 'c2', userId: null, email: 'customer@example.com' }); }],
    ['direct Client attached to different User', () => { clients[0].email = 'customer@example.com'; clients[0].userId = 'other-user'; }],
    ['direct Client colliding with an unlinked User', () => { clients[0].email = 'customer@example.com'; clients[0].userId = null; }],
  ] as const)('rejects %s before changing credentials', async (_name, arrange) => {
    arrange();
    await expect(handler.execute({ sessionToken: 'email-proof', newPassword: 'NewPassword123' })).rejects.toThrow(UnauthorizedException);
    expect(update).not.toHaveBeenCalled();
  });
});
