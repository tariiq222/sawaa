import { ServiceUnavailableException } from '@nestjs/common';
import { SendEmailHandler } from './send-email.handler';
import type { PrismaService } from '../../../infrastructure/database';
import type { EmailProviderFactory } from '../../../infrastructure/email/email-provider.factory';

const mockTemplate = {
  id: 'tpl-1',
  slug: 'welcome',
  subject: 'مرحباً {{client_name}}',
  htmlBody: '<p>{{client_name}}</p>',
  isActive: true,
};

const buildPrisma = (template: unknown = mockTemplate) => ({
  emailTemplate: { findFirst: jest.fn().mockResolvedValue(template) },
});

const buildFactory = (adapter: { isAvailable: () => boolean; sendMail: jest.Mock }) =>
  ({ resolve: jest.fn().mockResolvedValue(adapter) }) as unknown as EmailProviderFactory;

describe('SendEmailHandler', () => {
  it('interpolates template variables and sends via the configured provider', async () => {
    const prisma = buildPrisma();
    const sendMail = jest.fn().mockResolvedValue(undefined);
    const factory = buildFactory({ isAvailable: () => true, sendMail });

    await new SendEmailHandler(prisma as unknown as PrismaService, factory).execute({
      to: 'client@example.com',
      templateSlug: 'welcome',
      vars: { client_name: 'أحمد' },
    });

    expect(sendMail).toHaveBeenCalledWith({
      to: 'client@example.com',
      subject: 'مرحباً أحمد',
      html: '<p>أحمد</p>',
    });
  });

  it('throws ServiceUnavailableException when no provider is configured', async () => {
    const prisma = buildPrisma();
    const sendMail = jest.fn();
    const factory = buildFactory({ isAvailable: () => false, sendMail });

    await expect(
      new SendEmailHandler(prisma as unknown as PrismaService, factory).execute({
        to: 'client@example.com',
        templateSlug: 'welcome',
        vars: {},
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('returns silently when template is missing', async () => {
    const prisma = buildPrisma(null);
    const sendMail = jest.fn();
    const factory = buildFactory({ isAvailable: () => true, sendMail });

    await new SendEmailHandler(prisma as unknown as PrismaService, factory).execute({
      to: 'a@b.com',
      templateSlug: 'missing',
      vars: {},
    });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('returns silently when template is inactive', async () => {
    const prisma = buildPrisma({ ...mockTemplate, isActive: false });
    const sendMail = jest.fn();
    const factory = buildFactory({ isAvailable: () => true, sendMail });

    await new SendEmailHandler(prisma as unknown as PrismaService, factory).execute({
      to: 'a@b.com',
      templateSlug: 'welcome',
      vars: {},
    });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('propagates errors from the provider', async () => {
    const prisma = buildPrisma();
    const sendMail = jest.fn().mockRejectedValue(new Error('Provider down'));
    const factory = buildFactory({ isAvailable: () => true, sendMail });

    await expect(
      new SendEmailHandler(prisma as unknown as PrismaService, factory).execute({
        to: 'a@b.com',
        templateSlug: 'welcome',
        vars: {},
      }),
    ).rejects.toThrow('Provider down');
  });
});
