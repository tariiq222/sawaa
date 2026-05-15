import { AdminIpAllowlistGuard } from './admin-ip-allowlist.guard';
import { ExecutionContext } from '@nestjs/common';

describe('AdminIpAllowlistGuard', () => {
  let guard: AdminIpAllowlistGuard;
  let mockSettings: { get: jest.Mock };

  beforeEach(() => {
    mockSettings = { get: jest.fn() };
    guard = new AdminIpAllowlistGuard(mockSettings as any);
  });

  it('allows when no allowlist configured', async () => {
    mockSettings.get.mockResolvedValue([]);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: {}, ip: '10.0.0.5' }),
      }),
    } as ExecutionContext;
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('allows whitelisted IP', async () => {
    mockSettings.get.mockResolvedValue(['127.0.0.1']);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { 'x-real-ip': '127.0.0.1' }, ip: '' }),
      }),
    } as ExecutionContext;
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('blocks non-whitelisted IP', async () => {
    mockSettings.get.mockResolvedValue(['127.0.0.1']);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: {}, ip: '10.0.0.5' }),
      }),
    } as ExecutionContext;
    await expect(guard.canActivate(context)).rejects.toThrow();
  });
});
