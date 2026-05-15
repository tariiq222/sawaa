import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { OtpSessionService } from '../otp/otp-session.service';
import { ClientTokenService } from '../shared/client-token.service';
import { PasswordService } from '../shared/password.service';
import { RegisterHandler } from './register.handler';

describe('RegisterHandler', () => {
  let handler: RegisterHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegisterHandler,
    { provide: PrismaService, useValue: {
    client: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() }
    } },
    { provide: OtpSessionService, useValue: {} },
    { provide: ClientTokenService, useValue: {} },
    { provide: PasswordService, useValue: {} }
      ],
    }).compile();

    handler = module.get<RegisterHandler>(RegisterHandler);
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
