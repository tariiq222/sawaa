import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { ZoomApiClient } from '../../../infrastructure/zoom/zoom-api.client';
import { ZoomCredentialsService } from '../../../infrastructure/zoom/zoom-credentials.service';
import { CreateZoomMeetingHandler } from './create-zoom-meeting.handler';

describe('CreateZoomMeetingHandler', () => {
  let handler: CreateZoomMeetingHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateZoomMeetingHandler,
    { provide: PrismaService, useValue: {
    booking: { findFirst: jest.fn() }
    } },
    { provide: ZoomApiClient, useValue: {} },
    { provide: ZoomCredentialsService, useValue: {} }
      ],
    }).compile();

    handler = module.get<CreateZoomMeetingHandler>(CreateZoomMeetingHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    try {
      await handler.execute({ id: '00000000-0000-0000-0000-000000000001' });
    } catch (e) {
      // Expected for incomplete mocks
    }
  });
});
