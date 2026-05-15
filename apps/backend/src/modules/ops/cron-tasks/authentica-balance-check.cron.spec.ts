import { AuthenticaBalanceCheckCron } from './authentica-balance-check.cron';

const buildAuthentica = (configured: boolean, balance: number) => ({
  isConfigured: jest.fn().mockReturnValue(configured),
  getBalance: jest.fn().mockResolvedValue(balance),
});

const buildMailer = () => ({
  sendRaw: jest.fn().mockResolvedValue(undefined),
});

describe('AuthenticaBalanceCheckCron', () => {
  it('skips when authentica is not configured', async () => {
    const cron = new AuthenticaBalanceCheckCron(
      buildAuthentica(false, 0) as any,
      buildMailer() as any,
      { get: () => undefined } as any,
    );
    await expect(cron.execute()).resolves.not.toThrow();
  });

  it('logs balance when above threshold', async () => {
    const authentica = buildAuthentica(true, 1000);
    const cron = new AuthenticaBalanceCheckCron(
      authentica as any,
      buildMailer() as any,
      { get: () => undefined } as any,
    );
    await cron.execute();
    expect(authentica.getBalance).toHaveBeenCalled();
  });

  it('sends alert when balance is low and email is set', async () => {
    const authentica = buildAuthentica(true, 100);
    const mailer = buildMailer();
    const cron = new AuthenticaBalanceCheckCron(
      authentica as any,
      mailer as any,
      { get: () => 'owner@example.com' } as any,
    );
    await cron.execute();
    expect(mailer.sendRaw).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@example.com',
        templateSlug: 'authentica-balance-alert',
      }),
    );
  });

  it('warns and skips email when balance is low but no alert email configured', async () => {
    const authentica = buildAuthentica(true, 100);
    const mailer = buildMailer();
    const cron = new AuthenticaBalanceCheckCron(
      authentica as any,
      mailer as any,
      { get: () => undefined } as any,
    );
    await cron.execute();
    expect(mailer.sendRaw).not.toHaveBeenCalled();
  });
});
