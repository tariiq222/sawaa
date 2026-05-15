import { Test, TestingModule } from '@nestjs/testing';
import { PublicHealthController } from './health.controller';
import { HealthCheckHandler } from '../../modules/ops/health-check/health-check.handler';

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
});
