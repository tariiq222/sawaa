import { Test, TestingModule } from '@nestjs/testing';
import { PlatformMailProcessor } from './platform-mail.processor';
import { PrismaService } from '../../database';
import { BullMqService } from '../../queue/bull-mq.service';
import { ResendSenderService } from './resend-sender.service';

describe('PlatformMailProcessor', () => {
  let processor: PlatformMailProcessor;
  let prisma: PrismaService;
  let sender: ResendSenderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformMailProcessor,
        {
          provide: PrismaService,
          useValue: {
            platformMailDeliveryLog: {
              update: jest.fn().mockResolvedValue({}),
            },
          },
        },
        {
          provide: BullMqService,
          useValue: {
            createWorker: jest.fn(),
          },
        },
        {
          provide: ResendSenderService,
          useValue: {
            send: jest.fn(),
          },
        },
      ],
    }).compile();

    processor = module.get<PlatformMailProcessor>(PlatformMailProcessor);
    prisma = module.get<PrismaService>(PrismaService);
    sender = module.get<ResendSenderService>(ResendSenderService);
  });

  const mockJob = (attemptsMade = 0) =>
    ({
      data: {
        logId: 'log-1',
        recipient: 'test@example.com',
        templateName: 'otp',
        subject: 'Test',
        html: '<p>Hi</p>',
        from: 'noreply@test.com',
      },
      attemptsMade,
    } as any);

  it('should process successfully', async () => {
    (sender.send as jest.Mock).mockResolvedValue({ id: 'msg-1' });
    await processor.process(mockJob(0));
    expect(prisma.platformMailDeliveryLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SENT' }) }),
    );
  });

  it('should handle send failure', async () => {
    (sender.send as jest.Mock).mockRejectedValue(new Error('Send failed'));
    await expect(processor.process(mockJob(1))).rejects.toThrow('Send failed');
    expect(prisma.platformMailDeliveryLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
  });

  it('should handle log update failure after send failure', async () => {
    (sender.send as jest.Mock).mockRejectedValue(new Error('Send failed'));
    (prisma.platformMailDeliveryLog.update as jest.Mock).mockRejectedValue(new Error('DB error'));
    await expect(processor.process(mockJob(0))).rejects.toThrow('Send failed');
  });
});
