import { Test, TestingModule } from '@nestjs/testing';
import { OnBookingCancelledPromoteWaitlistHandler } from './on-booking-cancelled-promote-waitlist.handler';
import { PrismaService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';

describe('OnBookingCancelledPromoteWaitlistHandler', () => {
  let handler: OnBookingCancelledPromoteWaitlistHandler;
  let prisma: PrismaService;
  let eventBus: EventBusService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnBookingCancelledPromoteWaitlistHandler,
        {
          provide: PrismaService,
          useValue: {
            booking: { findFirst: jest.fn() },
            waitlistEntry: { findFirst: jest.fn(), update: jest.fn() },
          },
        },
        {
          provide: EventBusService,
          useValue: { subscribe: jest.fn() },
        },
      ],
    }).compile();

    handler = module.get<OnBookingCancelledPromoteWaitlistHandler>(OnBookingCancelledPromoteWaitlistHandler);
    prisma = module.get<PrismaService>(PrismaService);
    eventBus = module.get<EventBusService>(EventBusService);
  });

  it('should register event handler', () => {
    handler.register();
    expect(eventBus.subscribe).toHaveBeenCalled();
  });

  it('should promote waitlist entry when booking cancelled', async () => {
    (prisma.booking.findFirst as jest.Mock).mockResolvedValue({ serviceId: 's1', branchId: 'b1' });
    (prisma.waitlistEntry.findFirst as jest.Mock).mockResolvedValue({ id: 'w1', clientId: 'c1' });
    (prisma.waitlistEntry.update as jest.Mock).mockResolvedValue({});

    handler.register();
    const subscribeCall = (eventBus.subscribe as jest.Mock).mock.calls[0];
    const handlerFn = subscribeCall[1];
    await handlerFn({ payload: { bookingId: 'b1', employeeId: 'e1' } });
    expect(prisma.waitlistEntry.update).toHaveBeenCalled();
  });

  it('should do nothing when booking not found', async () => {
    (prisma.booking.findFirst as jest.Mock).mockResolvedValue(null);

    handler.register();
    const subscribeCall = (eventBus.subscribe as jest.Mock).mock.calls[0];
    const handlerFn = subscribeCall[1];
    await handlerFn({ payload: { bookingId: 'b1', employeeId: 'e1' } });
    expect(prisma.waitlistEntry.update).not.toHaveBeenCalled();
  });

  it('should do nothing when no waitlist entry', async () => {
    (prisma.booking.findFirst as jest.Mock).mockResolvedValue({ serviceId: 's1', branchId: 'b1' });
    (prisma.waitlistEntry.findFirst as jest.Mock).mockResolvedValue(null);

    handler.register();
    const subscribeCall = (eventBus.subscribe as jest.Mock).mock.calls[0];
    const handlerFn = subscribeCall[1];
    await handlerFn({ payload: { bookingId: 'b1', employeeId: 'e1' } });
    expect(prisma.waitlistEntry.update).not.toHaveBeenCalled();
  });
});
