import { Test, TestingModule } from '@nestjs/testing';
import { PlatformMailQueueService } from './platform-mail-queue.service';
import { PrismaService } from '../../database';
import { BullMqService } from '../../queue/bull-mq.service';

describe('PlatformMailQueueService', () => {
  let service: PlatformMailQueueService;
  let prisma: PrismaService;
  let bullmq: BullMqService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformMailQueueService,
        {
          provide: PrismaService,
          useValue: {
            platformMailDeliveryLog: {
              create: jest.fn().mockResolvedValue({ id: 'log-1' }),
              update: jest.fn().mockResolvedValue({}),
            },
          },
        },
        {
          provide: BullMqService,
          useValue: {
            getQueue: jest.fn().mockReturnValue({ add: jest.fn().mockResolvedValue({ id: 'job-1' }) }),
          },
        },
      ],
    }).compile();

    service = module.get<PlatformMailQueueService>(PlatformMailQueueService);
    prisma = module.get<PrismaService>(PrismaService);
    bullmq = module.get<BullMqService>(BullMqService);
  });

  it('should enqueue successfully', async () => {
    await service.enqueue({ recipient: 'test@example.com', templateName: 'otp', subject: 'Test', html: '<p>Hi</p>', from: 'noreply@test.com' });
    expect(bullmq.getQueue).toHaveBeenCalled();
    expect(prisma.platformMailDeliveryLog.create).toHaveBeenCalled();
  });

  it('should handle log create failure', async () => {
    (prisma.platformMailDeliveryLog.create as jest.Mock).mockRejectedValue(new Error('DB error'));
    await service.enqueue({ recipient: 'test@example.com', templateName: 'otp', subject: 'Test', html: '<p>Hi</p>', from: 'noreply@test.com' });
    expect(bullmq.getQueue).not.toHaveBeenCalled();
  });

  it('should handle queue add failure', async () => {
    (bullmq.getQueue as jest.Mock).mockReturnValue({ add: jest.fn().mockRejectedValue(new Error('Redis error')) });
    await service.enqueue({ recipient: 'test@example.com', templateName: 'otp', subject: 'Test', html: '<p>Hi</p>', from: 'noreply@test.com' });
    expect(prisma.platformMailDeliveryLog.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }));
  });
});
