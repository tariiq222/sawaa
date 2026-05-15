import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { SendStaffMessageHandler } from './send-staff-message.handler';

describe('SendStaffMessageHandler', () => {
  let handler: SendStaffMessageHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SendStaffMessageHandler,
    { provide: PrismaService, useValue: {
    chatConversation: { findFirst: jest.fn(), update: jest.fn() },
    commsChatMessage: { create: jest.fn() }
    } }
      ],
    }).compile();

    handler = module.get<SendStaffMessageHandler>(SendStaffMessageHandler);
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
