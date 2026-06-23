import { LookupUserHandler } from './lookup-user.handler';

/**
 * Regression guard for P0-12 (anti-enumeration):
 * The lookup-user endpoint MUST return the SAME shape regardless of whether
 * the supplied identifier matches a real user. Returning different shapes
 * for "exists" vs "not exists" lets an attacker enumerate every staff email
 * and phone number in the system by probing the endpoint.
 */
describe('LookupUserHandler', () => {
  let handler: LookupUserHandler;
  let prisma: { user: { findFirst: jest.Mock } };

  beforeEach(() => {
    prisma = { user: { findFirst: jest.fn() } };
    handler = new LookupUserHandler(prisma as any);
  });

  const baseCmd = { identifier: 'staff@example.com' };

  it('returns { exists: true, hasPassword: true } when the user exists (email)', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u1' });
    const result = await handler.execute(baseCmd);
    expect(result).toEqual({
      exists: true,
      hasPassword: true,
      identifier: 'staff@example.com',
      channel: 'EMAIL',
    });
    // The DB lookup must use the email branch
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'staff@example.com' } }),
    );
  });

  it('returns the IDENTICAL shape when the user does NOT exist (anti-enumeration)', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    const result = await handler.execute(baseCmd);
    expect(result).toEqual({
      exists: true,
      hasPassword: true,
      identifier: 'staff@example.com',
      channel: 'EMAIL',
    });
    // The DB was still consulted so timing stays comparable to a real lookup
    expect(prisma.user.findFirst).toHaveBeenCalledTimes(1);
  });

  it('never leaks `exists: false` even when prisma returns nothing (P0-12)', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    const result = await handler.execute({ identifier: 'ghost@example.com' });
    expect(result.exists).toBe(true);
    expect(result.hasPassword).toBe(true);
  });

  it('normalizes email identifiers (trim + lowercase) for the lookup query', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u1' });
    const result = await handler.execute({ identifier: '  Staff@Example.COM  ' });
    expect(result.identifier).toBe('staff@example.com');
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'staff@example.com' } }),
    );
  });

  it('routes phone identifiers through the SMS channel and uses the phone where clause', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u2' });
    const result = await handler.execute({ identifier: '+966512345678' });
    expect(result.channel).toBe('SMS');
    expect(result.exists).toBe(true);
    expect(result.hasPassword).toBe(true);
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { phone: '+966512345678' } }),
    );
  });

  it('SMS lookup returns the IDENTICAL shape whether the user exists or not', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    const result = await handler.execute({ identifier: '+966500000000' });
    expect(result).toEqual({
      exists: true,
      hasPassword: true,
      identifier: '+966500000000',
      channel: 'SMS',
    });
  });

  it('never returns the user id or any other DB-derived field (anti-enumeration)', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u1', email: 'x@example.com' });
    const result = await handler.execute(baseCmd);
    // Strict shape check — only the four allowed keys, no DB fields leak.
    expect(Object.keys(result).sort()).toEqual(['channel', 'exists', 'hasPassword', 'identifier']);
    expect((result as any).id).toBeUndefined();
    expect((result as any).email).toBeUndefined();
  });
});
