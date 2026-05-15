import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { CreateNotificationHandler } from './create-notification.handler';

describe('CreateNotificationHandler', () => {
  let handler: CreateNotificationHandler;
  let prisma: any;

  beforeEach(async () => {
    prisma = { notification: { create: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CreateNotificationHandler, { provide: PrismaService, useValue: prisma }],
    }).compile();

    handler = module.get<CreateNotificationHandler>(CreateNotificationHandler);
  });

  it('should create notification without metadata', async () => {
    prisma.notification.create.mockResolvedValue({ id: 'n1' });
    const dto = { recipientId: 'u1', recipientType: 'CLIENT' as const, type: 'BOOKING_REMINDER' as const, title: 'Reminder', body: 'Your booking is soon' };
    const result = await handler.execute(dto);
    expect(prisma.notification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ ...dto, metadata: undefined }),
    }));
    expect(result.id).toBe('n1');
  });

  it('should create notification with metadata', async () => {
    prisma.notification.create.mockResolvedValue({ id: 'n2' });
    const dto = { recipientId: 'u1', recipientType: 'CLIENT' as const, type: 'BOOKING_REMINDER' as const, title: 'Reminder', body: 'Soon', metadata: { bookingId: 'b1' } };
    await handler.execute(dto);
    expect(prisma.notification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ metadata: { bookingId: 'b1' } }),
    }));
  });
});
