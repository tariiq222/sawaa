import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { PublicHealthController } from './health.controller';
import { HealthCheckHandler } from '../../modules/ops/health-check/health-check.handler';
import * as shutdownState from '../../common/shutdown.state';

describe('PublicHealthController', () => {
  let controller: PublicHealthController;
  let healthCheck: HealthCheckHandler;

  beforeEach(async () => {
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
  });

  it('should return liveness', () => {
    const result = controller.getLiveness();
    expect(result.status).toBe('ok');
    expect(result.timestamp).toBeDefined();
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
