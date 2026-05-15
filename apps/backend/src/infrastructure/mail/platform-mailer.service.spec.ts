import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PlatformMailerService } from './platform-mailer.service';
import { PlatformMailQueueService } from './platform-mail-queue/platform-mail-queue.service';

describe('PlatformMailerService', () => {
  let service: PlatformMailerService;
  let queue: { enqueue: jest.Mock };

  beforeEach(async () => {
    queue = { enqueue: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformMailerService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('Test <test@example.com>') } },
        { provide: PlatformMailQueueService, useValue: queue },
      ],
    }).compile();

    service = module.get<PlatformMailerService>(PlatformMailerService);
  });

  it('should send OTP login email', async () => {
    await service.sendOtpLogin('user@example.com', { code: '123456', expiresInMinutes: 5 });
    expect(queue.enqueue).toHaveBeenCalled();
  });

  it('should send raw email', async () => {
    await service.sendRaw({ to: 'user@example.com', subject: 'Test', html: '<p>Hello</p>', templateSlug: 'test' });
    expect(queue.enqueue).toHaveBeenCalledWith(expect.objectContaining({ recipient: 'user@example.com', subject: 'Test' }));
  });

  it('should use default from when config not set', async () => {
    const q = { enqueue: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformMailerService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
        { provide: PlatformMailQueueService, useValue: q },
      ],
    }).compile();
    const svc = module.get<PlatformMailerService>(PlatformMailerService);
    await svc.sendRaw({ to: 'user@example.com', subject: 'Test', html: '<p>Hello</p>', templateSlug: 'test' });
    expect(q.enqueue).toHaveBeenCalledWith(expect.objectContaining({ from: 'Sawaa <noreply@webvue.pro>' }));
  });
});
