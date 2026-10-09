import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { MobilePasswordLoginHandler } from './mobile-password-login.handler';
import { ClientLoginHandler } from '../client-auth/client-login.handler';
import { PasswordService } from '../shared/password.service';

const verified = new Date('2026-01-01');
const matches = (row: any, where: any): boolean => Object.entries(where).every(([key, value]: [string, any]) => {
  if (key === 'OR') return value.some((entry: any) => matches(row, entry));
  if (value && typeof value === 'object' && 'in' in value) return value.in.includes(row[key]);
  if (value && typeof value === 'object' && 'equals' in value) return row[key]?.toLowerCase() === value.equals.toLowerCase();
  return row[key] === value;
});

describe('MobilePasswordLoginHandler', () => {
  let handler: MobilePasswordLoginHandler;
  let clients: any[];
  let users: any[];
  let passwordHash: string;
  let counters: Map<string, number>;
  let issueTokenPair: jest.Mock;

  beforeAll(async () => { passwordHash = await hash('CorrectPass123', 4); });
  beforeEach(() => {
    clients = [{ id: 'client-1', userId: 'user-1', email: 'client@example.com', phone: '+966501234567',
      isActive: true, deletedAt: null, emailVerified: verified, phoneVerified: verified, passwordHash,
      tokenVersion: 7, loginAttempts: 0, lockoutUntil: null }];
    users = [{ id: 'user-1', email: 'client@example.com', phone: '+966501234567', role: 'CLIENT',
      isSuperAdmin: false, isActive: true, emailVerifiedAt: verified, phoneVerifiedAt: verified }];
    const prisma = {
      client: {
        findMany: async ({ where }: any) => clients.filter(row => matches(row, where)),
        findFirst: async ({ where }: any) => clients.find(row => matches(row, where)) ?? null,
        update: async ({ where, data }: any) => {
          const row = clients.find(row => row.id === where.id);
          for (const [key, value] of Object.entries(data) as [string, any][]) {
            if (value !== undefined) row[key] = value && typeof value === 'object' && 'increment' in value ? row[key] + value.increment : value;
          }
          return row;
        },
      },
      user: {
        findMany: async ({ where }: any) => users.filter(row => matches(row, where)),
        findUnique: async ({ where }: any) => users.find(row => matches(row, where)) ?? null,
      },
    };
    counters = new Map();
    const redisClient = {
      multi: () => {
        let counterKey = '';
        const pipeline = { incr: (key: string) => { counterKey = key; return pipeline; },
          expire: () => pipeline, exec: async () => {
            const next = (counters.get(counterKey) ?? 0) + 1;
            counters.set(counterKey, next);
            return [[null, next], [null, 1]];
          } };
        return pipeline;
      },
      expire: async () => 1,
      del: async (key: string) => { counters.delete(key); },
    };
    issueTokenPair = jest.fn().mockResolvedValue({ accessToken: 'client-access', rawRefresh: 'client-refresh', accessMaxAgeMs: 1, refreshMaxAgeMs: 2 });
    const login = new ClientLoginHandler(prisma as any, { getClient: () => redisClient } as any,
      new PasswordService(), { issueTokenPair } as any);
    handler = new MobilePasswordLoginHandler(prisma as any, login);
  });

  it.each([{ email: ' CLIENT@EXAMPLE.COM ' }, { phone: '0501234567' }])('returns only native client tokens for %j', async (identifier) => {
    expect(await handler.execute({ ...identifier, password: 'CorrectPass123' }, '1.2.3.4')).toEqual({
      sessionKind: 'client', tokens: { accessToken: 'client-access', refreshToken: 'client-refresh' },
    });
    expect(issueTokenPair).toHaveBeenCalledWith({ id: 'client-1', email: 'client@example.com', emailVerified: expect.any(Date), tokenVersion: 7 });
    expect(clients[0].lastLoginAt).toBeInstanceOf(Date);
  });

  it('resolves a verified User email when the linked Client has only a phone', async () => {
    clients[0].email = null;
    clients[0].emailVerified = null;
    expect((await handler.execute({ email: 'client@example.com', password: 'CorrectPass123' })).sessionKind).toBe('client');
  });

  it('allows a verified standalone website client', async () => {
    users = [];
    clients[0].userId = null;
    expect((await handler.execute({ email: 'client@example.com', password: 'CorrectPass123' })).sessionKind).toBe('client');
  });

  it.each([
    ['unknown', () => { clients = []; users = []; }],
    ['missing password', () => { clients[0].passwordHash = null; }],
    ['inactive client', () => { clients[0].isActive = false; }],
    ['deleted client', () => { clients[0].deletedAt = verified; }],
    ['inactive user', () => { users[0].isActive = false; }],
    ['missing linked user', () => { users = []; }],
    ['staff', () => { users[0].role = 'ADMIN'; }],
    ['superadmin', () => { users[0].isSuperAdmin = true; }],
    ['unverified email', () => { clients[0].emailVerified = null; users[0].emailVerifiedAt = null; }],
    ['mismatched phone', () => { users[0].phone = '+966509999999'; }],
    ['mismatched email', () => { clients[0].email = 'other@example.com'; }],
    ['duplicate client', () => { clients.push({ ...clients[0], id: 'client-2' }); }],
    ['duplicate user', () => { users.push({ ...users[0], id: 'user-2' }); }],
    ['unlinked collision', () => { clients[0].userId = null; }],
    ['lockout', () => { clients[0].lockoutUntil = new Date(Date.now() + 60_000); }],
  ] as const)('rejects %s without tokens or account disclosure', async (_name, arrange) => {
    arrange();
    await expect(handler.execute({ email: 'client@example.com', password: 'CorrectPass123' })).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
    expect(issueTokenPair).not.toHaveBeenCalled();
  });

  it('rejects unverified phone ownership', async () => {
    clients[0].phoneVerified = null;
    users[0].phoneVerifiedAt = null;
    await expect(handler.execute({ phone: '+966501234567', password: 'CorrectPass123' })).rejects.toThrow(UnauthorizedException);
    expect(issueTokenPair).not.toHaveBeenCalled();
  });

  it('keeps the existing failed-password lockout and normalizes its counter key', async () => {
    for (let i = 0; i < 4; i++) {
      await expect(handler.execute({ phone: '0501234567', password: 'WrongPass123' }, '1.2.3.4')).rejects.toThrow('Invalid credentials');
    }
    expect(clients[0].loginAttempts).toBe(4);
    expect(clients[0].lockoutUntil.getTime()).toBeGreaterThan(Date.now());
    expect(counters.get('client_login:id:+966501234567')).toBe(4);
    expect(issueTokenPair).not.toHaveBeenCalled();
  });

  it.each(['client_login:id:client@example.com', 'client_login:ip:1.2.3.4'])('preserves rate limit at %s without exposing account state', async (key) => {
    counters.set(key, key.includes(':ip:') ? 20 : 5);
    await expect(handler.execute({ email: 'client@example.com', password: 'CorrectPass123' }, '1.2.3.4')).rejects.toThrow('Invalid credentials');
    expect(issueTokenPair).not.toHaveBeenCalled();
  });

  it.each([{ password: 'CorrectPass123' }, { email: 'client@example.com', phone: '+966501234567', password: 'CorrectPass123' }])('rejects invalid identifier shape', async (dto) => {
    await expect(handler.execute(dto)).rejects.toThrow(BadRequestException);
    expect(issueTokenPair).not.toHaveBeenCalled();
  });
});
