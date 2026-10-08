import * as bcrypt from 'bcryptjs';
import { EmployeeContactStore } from './employee-contact.store';
import { RequestEmployeeContactHandler } from './request-employee-contact.handler';
import { VerifyEmployeeContactHandler } from './verify-employee-contact.handler';

async function fixture() {
  const user = { id: 'user-a', email: 'old@example.com', phone: '+966501234567', isActive: true, role: 'EMPLOYEE' };
  const employee = { id: 'employee-a', userId: user.id, isActive: true, email: user.email, phone: user.phone };
  const challenges: Array<Record<string, unknown>> = [];
  const tx = {
    $queryRaw: jest.fn(async () => []),
    user: { findUnique: jest.fn(async () => user), findFirst: jest.fn(async () => null), update: jest.fn(async ({ data }) => Object.assign(user, data)) },
    employee: { findFirst: jest.fn(async ({ where }) => where.userId ? employee : null), update: jest.fn(async ({ data }) => Object.assign(employee, data)) },
    client: { findFirst: jest.fn(async () => null) },
    passwordResetToken: { deleteMany: jest.fn() }, emailVerificationToken: { deleteMany: jest.fn() },
    employeeContactChallenge: {
      create: jest.fn(async ({ data }) => { const row = { id: 'challenge-a', consumedAt: null, attempts: 0, ready: false, ...data }; challenges.push(row); return row; }),
      findUnique: jest.fn(async ({ where }) => challenges.find(c => c.id === where.id) ?? null),
      updateMany: jest.fn(async ({ where, data }) => { let count = 0; for (const row of challenges) { if (where.id && row.id !== where.id) continue; if (where.userId && row.userId !== where.userId) continue; if (where.channel && row.channel !== where.channel) continue; if (row.consumedAt) continue; Object.assign(row, data); count++; } return { count }; }),
      update: jest.fn(async ({ where, data }) => { const row = challenges.find(c => c.id === where.id)!; if (data.attempts?.increment) row.attempts = Number(row.attempts) + data.attempts.increment; else Object.assign(row, data); return row; }),
    },
  };
  const transactions = { withTransaction: async (fn: (value: typeof tx) => unknown) => fn(tx) };
  const store = new EmployeeContactStore(transactions as never);
  let sentCode = '';
  const delivery = { send: jest.fn(async (_channel, _target, code) => { sentCode = code; }) };
  const limiter = { reserve: jest.fn(async () => ({ key: 'key', id: 'id' })), settle: jest.fn() };
  const request = new RequestEmployeeContactHandler(store, delivery as never, limiter as never);
  const verify = new VerifyEmployeeContactHandler(store);
  return { user, employee, tx, challenges, request, verify, delivery, code: () => sentCode };
}

describe('Employee verified contact change', () => {
  it('keeps the old login until the new address is verified, then updates both records', async () => {
    const f = await fixture();
    const result = await f.request.execute('user-a', { channel: 'EMAIL', identifier: ' NEW@Example.com ' });
    expect(f.user.email).toBe('old@example.com');
    expect(f.employee.email).toBe('old@example.com');
    expect(await bcrypt.compare(f.code(), String(f.challenges[0].codeHash))).toBe(true);
    await f.verify.execute('user-a', { challengeId: result.challengeId, code: f.code() });
    expect(f.user.email).toBe('new@example.com');
    expect(f.employee.email).toBe('new@example.com');
    expect(f.user).toHaveProperty('emailVerifiedAt', expect.any(Date));
    expect(f.challenges[0].consumedAt).toBeInstanceOf(Date);
    await expect(f.verify.execute('user-a', { challengeId: result.challengeId, code: f.code() })).rejects.toThrow();
  });

  it('cannot verify another user challenge or a stale identity snapshot', async () => {
    const f = await fixture();
    const { challengeId } = await f.request.execute('user-a', { channel: 'SMS', identifier: '+966509876543' });
    await expect(f.verify.execute('user-b', { challengeId, code: f.code() })).rejects.toThrow();
    expect(f.user.phone).toBe('+966501234567');
    f.user.phone = '+966500000000';
    await expect(f.verify.execute('user-a', { challengeId, code: f.code() })).rejects.toThrow();
    expect(f.user.phone).toBe('+966500000000');
  });

  it('commits incorrect attempts and locks out the challenge after five failures', async () => {
    const f = await fixture();
    const { challengeId } = await f.request.execute('user-a', { channel: 'EMAIL', identifier: 'new@example.com' });
    const wrong = f.code() === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) await expect(f.verify.execute('user-a', { challengeId, code: wrong })).rejects.toThrow();
    expect(f.challenges[0].attempts).toBe(5);
    await expect(f.verify.execute('user-a', { challengeId, code: f.code() })).rejects.toThrow();
    expect(f.user.email).toBe('old@example.com');
  });

  it('rejects expired codes and collisions rechecked at confirmation', async () => {
    const f = await fixture();
    const { challengeId } = await f.request.execute('user-a', { channel: 'EMAIL', identifier: 'new@example.com' });
    f.challenges[0].expiresAt = new Date(0);
    await expect(f.verify.execute('user-a', { challengeId, code: f.code() })).rejects.toThrow();
    f.challenges[0].expiresAt = new Date(Date.now() + 60000);
    f.tx.client.findFirst.mockResolvedValueOnce({ id: 'other-client' } as never);
    await expect(f.verify.execute('user-a', { challengeId, code: f.code() })).rejects.toThrow();
    expect(f.user.email).toBe('old@example.com');
  });

  it('never enables verification after a provider failure', async () => {
    const f = await fixture();
    f.delivery.send.mockRejectedValueOnce(new Error('unavailable'));
    await expect(f.request.execute('user-a', { channel: 'EMAIL', identifier: 'new@example.com' })).rejects.toThrow();
    await expect(f.verify.execute('user-a', { challengeId: 'challenge-a', code: f.code() })).rejects.toThrow();
    expect(f.user.email).toBe('old@example.com');
  });
});
