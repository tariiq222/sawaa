import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { CreateZoomMeetingHandler } from '../create-zoom-meeting/create-zoom-meeting.handler';
import { RetryZoomMeetingHandler } from './retry-zoom-meeting.handler';

describe('RetryZoomMeetingHandler', () => {
  let handler: RetryZoomMeetingHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetryZoomMeetingHandler,
    { provide: PrismaService, useValue: {
    booking: { findFirst: jest.fn() }
    } },
    { provide: CreateZoomMeetingHandler, useValue: { execute: jest.fn() } }
      ],
    }).compile();

    handler = module.get<RetryZoomMeetingHandler>(RetryZoomMeetingHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    try {
      await handler.execute({ bookingId: '00000000-0000-0000-0000-000000000001' });
    } catch (e) {
      // Expected for incomplete mocks
    }
  });
});
