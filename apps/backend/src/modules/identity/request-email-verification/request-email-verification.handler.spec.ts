import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RequestEmailVerificationHandler } from './request-email-verification.handler';
import { PrismaService } from '../../../infrastructure/database';
import { SendEmailQueueService } from '../../comms/send-email/send-email-queue.service';

describe('RequestEmailVerificationHandler', () => {
  let handler: RequestEmailVerificationHandler;
  let prisma: any;
  let sendEmailQueue: { enqueue: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      emailVerificationToken: { deleteMany: jest.fn(), create: jest.fn() },
    };
    sendEmailQueue = { enqueue: jest.fn().mockResolvedValue(undefined) };
    config = { get: jest.fn().mockReturnValue('https://app.test') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestEmailVerificationHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: SendEmailQueueService, useValue: sendEmailQueue },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    handler = module.get<RequestEmailVerificationHandler>(RequestEmailVerificationHandler);
  });

  it('should throw NotFoundException when user not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(handler.execute({ userId: 'missing' })).rejects.toThrow(NotFoundException);
  });

  it('should return success when email already verified', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'test@test.com', name: 'Test', emailVerifiedAt: new Date() });
    const result = await handler.execute({ userId: 'u1' });
    expect(result.success).toBe(true);
    expect(prisma.emailVerificationToken.deleteMany).not.toHaveBeenCalled();
    expect(sendEmailQueue.enqueue).not.toHaveBeenCalled();
  });

  it('should create token and enqueue the verification email', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'test@test.com', name: 'Test', emailVerifiedAt: null });
    prisma.emailVerificationToken.create.mockResolvedValue({});

    const result = await handler.execute({ userId: 'u1' });
    expect(result.success).toBe(true);
    expect(prisma.emailVerificationToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(prisma.emailVerificationToken.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'u1', tokenHash: expect.any(String), tokenSelector: expect.any(String) }),
    }));
    expect(sendEmailQueue.enqueue).toHaveBeenCalledWith(expect.objectContaining({
      to: 'test@test.com',
      templateSlug: 'user_email_verification',
      vars: expect.objectContaining({ userName: 'Test', verifyUrl: expect.stringContaining('/verify-email?token=') }),
    }));
  });

  it('should use WEBSITE_URL fallback when PUBLIC_WEBSITE_URL not set', async () => {
    config.get.mockImplementation((key: string) => key === 'WEBSITE_URL' ? 'https://fallback.test' : undefined);
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'test@test.com', name: 'Test', emailVerifiedAt: null });
    prisma.emailVerificationToken.create.mockResolvedValue({});

    await handler.execute({ userId: 'u1' });
    expect(sendEmailQueue.enqueue).toHaveBeenCalledWith(expect.objectContaining({
      vars: expect.objectContaining({ verifyUrl: expect.stringContaining('https://fallback.test') }),
    }));
  });
});
