import { Test } from '@nestjs/testing';
import { RequestPasswordResetHandler } from './request-password-reset.handler';
import { PrismaService } from '../../../../infrastructure/database';
import { SendEmailHandler } from '../../../comms/send-email/send-email.handler';
import { ConfigService } from '@nestjs/config';

describe('RequestPasswordResetHandler', () => {
  let handler: RequestPasswordResetHandler;
  let prisma: { user: { findUnique: jest.Mock }; passwordResetToken: { create: jest.Mock; updateMany: jest.Mock } };
  let sendEmail: { execute: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      passwordResetToken: { create: jest.fn().mockResolvedValue({}), updateMany: jest.fn().mockResolvedValue({}) },
    };
    sendEmail = { execute: jest.fn().mockResolvedValue(undefined) };
    config = { get: jest.fn().mockReturnValue('https://app.deqah.test') };
    const moduleRef = await Test.createTestingModule({
      providers: [
        RequestPasswordResetHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: SendEmailHandler, useValue: sendEmail },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    handler = moduleRef.get(RequestPasswordResetHandler);
  });

  it('returns silently and sends nothing when user does not exist (enumeration safe)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await handler.execute({ email: 'nobody@x.com' });
    expect(sendEmail.execute).not.toHaveBeenCalled();
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
    expect(sendEmail.execute).toHaveBeenCalledWith(expect.objectContaining({
      to: 'a@b.com',
      templateSlug: 'user_password_reset',
      vars: expect.objectContaining({ userName: 'Alice', resetUrl: expect.stringContaining('https://app.deqah.test/reset-password?token=') }),
    }));
  });

  it('skips sending when user is inactive', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', name: 'Alice', isActive: false });
    await handler.execute({ email: 'a@b.com' });
    expect(sendEmail.execute).not.toHaveBeenCalled();
  });
});
