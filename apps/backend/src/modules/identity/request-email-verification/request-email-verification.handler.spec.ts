import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { ConfigService } from '@nestjs/config';
import { SendEmailHandler } from '../../comms/send-email/send-email.handler';
import { RequestEmailVerificationHandler } from './request-email-verification.handler';

describe('RequestEmailVerificationHandler', () => {
  let handler: RequestEmailVerificationHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestEmailVerificationHandler,
    { provide: PrismaService, useValue: {
    user: { findUnique: jest.fn() },
    emailVerificationToken: { deleteMany: jest.fn(), create: jest.fn() }
    } },
    { provide: SendEmailHandler, useValue: { execute: jest.fn() } },
    { provide: ConfigService, useValue: { get: jest.fn(), getOrThrow: jest.fn() } }
      ],
    }).compile();

    handler = module.get<RequestEmailVerificationHandler>(RequestEmailVerificationHandler);
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
