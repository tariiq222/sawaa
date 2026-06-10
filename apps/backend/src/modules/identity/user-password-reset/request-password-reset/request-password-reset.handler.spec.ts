import { Test } from '@nestjs/testing';
import { RequestPasswordResetHandler } from './request-password-reset.handler';
import { PrismaService } from '../../../../infrastructure/database';
import { SendEmailQueueService } from '../../../comms/send-email/send-email-queue.service';
import { ConfigService } from '@nestjs/config';

describe('RequestPasswordResetHandler', () => {
  let handler: RequestPasswordResetHandler;
  let prisma: { user: { findUnique: jest.Mock }; passwordResetToken: { create: jest.Mock; updateMany: jest.Mock } };
  let sendEmailQueue: { enqueue: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      passwordResetToken: { create: jest.fn().mockResolvedValue({}), updateMany: jest.fn().mockResolvedValue({}) },
    };
    sendEmailQueue = { enqueue: jest.fn().mockResolvedValue(undefined) };
    config = { get: jest.fn().mockReturnValue('https://app.sawaa.test') };
    const moduleRef = await Test.createTestingModule({
      providers: [
        RequestPasswordResetHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: SendEmailQueueService, useValue: sendEmailQueue },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    handler = moduleRef.get(RequestPasswordResetHandler);
  });

  it('returns silently and enqueues nothing when user does not exist (enumeration safe)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await handler.execute({ email: 'nobody@x.com' });
    expect(sendEmailQueue.enqueue).not.toHaveBeenCalled();
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it('invalidates prior tokens and creates a new one for an existing user', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', name: 'Alice', isActive: true });
    await handler.execute({ email: 'a@b.com' });
    expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', consumedAt: null },
      data: { consumedAt: expect.any(Date) },
    });
    expect(prisma.passwordResetToken.create).toHaveBeenCalled();
    expect(sendEmailQueue.enqueue).toHaveBeenCalledWith(expect.objectContaining({
      to: 'a@b.com',
      templateSlug: 'user_password_reset',
      vars: expect.objectContaining({ userName: 'Alice', resetUrl: expect.stringContaining('https://app.sawaa.test/reset-password?token=') }),
    }));
  });

  it('skips enqueueing when user is inactive', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', name: 'Alice', isActive: false });
    await handler.execute({ email: 'a@b.com' });
    expect(sendEmailQueue.enqueue).not.toHaveBeenCalled();
  });
});
