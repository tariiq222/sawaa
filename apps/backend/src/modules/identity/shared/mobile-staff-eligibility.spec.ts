import { isMobileStaffEligible } from './mobile-staff-eligibility';

describe('mobile staff required second factor', () => {
  it.each([
    { role: 'SUPER_ADMIN', isSuperAdmin: false },
    { role: 'ADMIN', isSuperAdmin: true },
  ])('blocks single-factor sessions for $role / $isSuperAdmin', async (user) => {
    const db = { employee: { findFirst: jest.fn().mockResolvedValue({ id: 'emp' }) } };
    const settings = { get: jest.fn().mockResolvedValue(true) };
    await expect(isMobileStaffEligible(db as never, settings as never, { id: 'user', ...user })).resolves.toBe(false);
  });
  it('preserves eligible ordinary staff and super-admins when 2FA is disabled', async () => {
    const db = { employee: { findFirst: jest.fn().mockResolvedValue({ id: 'emp' }) } };
    const settings = { get: jest.fn().mockResolvedValue(true) };
    await expect(isMobileStaffEligible(db as never, settings as never, { id: 'user', role: 'EMPLOYEE', isSuperAdmin: false } as never)).resolves.toBe(true);
    settings.get.mockResolvedValue(false);
    await expect(isMobileStaffEligible(db as never, settings as never, { id: 'user', role: 'SUPER_ADMIN', isSuperAdmin: false } as never)).resolves.toBe(true);
    db.employee.findFirst.mockResolvedValue(null);
    await expect(isMobileStaffEligible(db as never, settings as never, { id: 'user' } as never)).resolves.toBe(false);
  });
});
