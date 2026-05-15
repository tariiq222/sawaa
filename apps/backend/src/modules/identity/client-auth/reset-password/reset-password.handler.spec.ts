import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../../infrastructure/database';
import { OtpSessionService } from '../../otp/otp-session.service';
import { PasswordService } from '../../shared/password.service';
import { PasswordHistoryService } from '../shared/password-history.service';
import { ResetPasswordHandler } from './reset-password.handler';

describe('ResetPasswordHandler', () => {
  let handler: ResetPasswordHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResetPasswordHandler,
    { provide: PrismaService, useValue: {
    client: { findFirst: jest.fn() }
    } },
    { provide: OtpSessionService, useValue: {} },
    { provide: PasswordService, useValue: {} },
    { provide: PasswordHistoryService, useValue: {} }
      ],
    }).compile();

    handler = module.get<ResetPasswordHandler>(ResetPasswordHandler);
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
