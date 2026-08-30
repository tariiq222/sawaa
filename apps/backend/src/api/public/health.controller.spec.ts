import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { PublicHealthController } from './health.controller';
import { HealthCheckHandler } from '../../modules/ops/health-check/health-check.handler';
import * as shutdownState from '../../common/shutdown.state';
import packageJson from '../../../package.json';

describe('PublicHealthController', () => {
  let controller: PublicHealthController;
  let healthCheck: HealthCheckHandler;
  let originalAppVersion: string | undefined;
  let originalGitSha: string | undefined;

  beforeEach(async () => {
    originalAppVersion = process.env.APP_VERSION;
    originalGitSha = process.env.GIT_SHA;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicHealthController],
      providers: [
        { provide: HealthCheckHandler, useValue: { execute: jest.fn() } },
      ],
    }).compile();

    controller = module.get<PublicHealthController>(PublicHealthController);
    healthCheck = module.get<HealthCheckHandler>(HealthCheckHandler);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalAppVersion === undefined) delete process.env.APP_VERSION;
    else process.env.APP_VERSION = originalAppVersion;
    if (originalGitSha === undefined) delete process.env.GIT_SHA;
    else process.env.GIT_SHA = originalGitSha;
  });

  it('should return liveness', () => {
    const result = controller.getLiveness();
    expect(result.status).toBe('ok');
    expect(result.timestamp).toBeDefined();
  });

  it('includes configured build metadata in liveness', () => {
    process.env.APP_VERSION = '2.2.0';
    process.env.GIT_SHA = 'a1b2c3d';

    expect(controller.getLiveness()).toEqual(expect.objectContaining({
      version: '2.2.0',
      gitSha: 'a1b2c3d',
    }));
  });

  it('uses safe fallback metadata when build metadata is absent', () => {
    delete process.env.APP_VERSION;
    delete process.env.GIT_SHA;

    expect(controller.getLiveness()).toEqual(expect.objectContaining({
      version: packageJson.version,
      gitSha: 'unknown',
    }));
  });

  it('should return readiness', async () => {
    (healthCheck.execute as jest.Mock).mockResolvedValue({ status: 'ok', db: 'ok', redis: 'ok', queue: 'ok' });
    const result = await controller.getReadiness();
    expect(result.status).toBe('ok');
  });

  it('should return health check', async () => {
    (healthCheck.execute as jest.Mock).mockResolvedValue({ status: 'ok', db: 'ok', redis: 'ok', queue: 'ok' });
    const result = await controller.check();
    expect(result.status).toBe('ok');
  });

  it('readiness throws ServiceUnavailableException while the app is shutting down', async () => {
    jest.spyOn(shutdownState, 'isShuttingDown').mockReturnValue(true);
    await expect(controller.getReadiness()).rejects.toThrow(ServiceUnavailableException);
    expect(healthCheck.execute).not.toHaveBeenCalled();
  });

  it('the bare /health check also throws ServiceUnavailableException while shutting down', async () => {
    jest.spyOn(shutdownState, 'isShuttingDown').mockReturnValue(true);
    // `check()` is declared as returning Promise<HealthCheckResult> but the
    // shutdown branch throws synchronously, so the throw surfaces at the call
    // site — wrap the call to verify both the exception type and the message.
    let caught: unknown;
    try {
      await controller.check();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ServiceUnavailableException);
    expect((caught as ServiceUnavailableException).message).toContain('shutting down');
    expect(healthCheck.execute).not.toHaveBeenCalled();
  });

  it('readiness still calls healthCheck.execute when NOT shutting down', async () => {
    jest.spyOn(shutdownState, 'isShuttingDown').mockReturnValue(false);
    (healthCheck.execute as jest.Mock).mockResolvedValue({ status: 'ok' });
    await controller.getReadiness();
    expect(healthCheck.execute).toHaveBeenCalledTimes(1);
  });

  it('the bare /health check still calls healthCheck.execute when NOT shutting down', async () => {
    jest.spyOn(shutdownState, 'isShuttingDown').mockReturnValue(false);
    (healthCheck.execute as jest.Mock).mockResolvedValue({ status: 'ok' });
    const result = await controller.check();
    expect(result.status).toBe('ok');
    expect(healthCheck.execute).toHaveBeenCalledTimes(1);
  });
});
