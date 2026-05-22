import { AuthenticaBalanceCheckCron } from './authentica-balance-check.cron';

const buildAuthentica = (configured: boolean, balance: number) => ({
  isConfigured: jest.fn().mockReturnValue(configured),
  getBalance: jest.fn().mockResolvedValue(balance),
});

const buildAdapter = (available = true) => ({
  isAvailable: () => available,
  sendMail: jest.fn().mockResolvedValue(undefined),
});

const buildFactory = (adapter: ReturnType<typeof buildAdapter>) => ({
  resolve: jest.fn().mockResolvedValue(adapter),
});

describe('AuthenticaBalanceCheckCron', () => {
  it('skips when authentica is not configured', async () => {
    const factory = buildFactory(buildAdapter());
    const cron = new AuthenticaBalanceCheckCron(
      buildAuthentica(false, 0) as any,
      factory as any,
      { get: () => undefined } as any,
    );
    await expect(cron.execute()).resolves.not.toThrow();
    expect(factory.resolve).not.toHaveBeenCalled();
  });

  it('does not send email when balance is above threshold', async () => {
    const adapter = buildAdapter();
    const cron = new AuthenticaBalanceCheckCron(
      buildAuthentica(true, 1000) as any,
      buildFactory(adapter) as any,
      { get: () => 'owner@example.com' } as any,
    );
    await cron.execute();
    expect(adapter.sendMail).not.toHaveBeenCalled();
  });

  it('sends alert when balance is low and email is set', async () => {
    const adapter = buildAdapter();
    const cron = new AuthenticaBalanceCheckCron(
      buildAuthentica(true, 100) as any,
      buildFactory(adapter) as any,
      { get: () => 'owner@example.com' } as any,
    );
    await cron.execute();
    expect(adapter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'owner@example.com' }),
    );
  });

  it('skips email when no alert email is configured', async () => {
    const adapter = buildAdapter();
    const cron = new AuthenticaBalanceCheckCron(
      buildAuthentica(true, 100) as any,
      buildFactory(adapter) as any,
      { get: () => undefined } as any,
    );
    await cron.execute();
    expect(adapter.sendMail).not.toHaveBeenCalled();
  });

  it('skips email when no email provider configured', async () => {
    const adapter = buildAdapter(false);
    const cron = new AuthenticaBalanceCheckCron(
      buildAuthentica(true, 100) as any,
      buildFactory(adapter) as any,
      { get: () => 'owner@example.com' } as any,
    );
    await cron.execute();
    expect(adapter.sendMail).not.toHaveBeenCalled();
  });
});
