import { SendEmailHandler } from './send-email.handler';
import type { SmtpService } from '../../../infrastructure/mail';
import type { PrismaService } from '../../../infrastructure/database';
import type { TenantContextService } from '../../../common/tenant';
import type { EmailProviderFactory } from '../../../infrastructure/email/email-provider.factory';

const ORG_ID = 'org-test-1';

const mockTemplate = {
  id: 'tpl-1',
  slug: 'welcome',
  subject: 'مرحباً',
  htmlBody: '<p>{{client_name}}</p>',
  isActive: true,
};

const buildPrisma = () => ({
  emailTemplate: {
    findFirst: jest.fn().mockResolvedValue(mockTemplate),
  },
});

const buildTenant = () => ({
  requireOrganizationIdOrDefault: jest.fn().mockReturnValue(ORG_ID),
} as unknown as TenantContextService);

/** NoOp email factory — simulates no tenant provider configured */
const buildNoOpFactory = () =>
  ({
    forCurrentTenant: jest.fn().mockResolvedValue({ isAvailable: () => false }),
  }) as unknown as EmailProviderFactory;

describe('SendEmailHandler', () => {
  it('substitutes template variables and sends email via platform SMTP when no tenant provider', async () => {
    const prisma = buildPrisma();
    const smtp = {
      isAvailable: jest.fn().mockReturnValue(true),
      sendMail: jest.fn().mockResolvedValue(undefined),
    };
    await new SendEmailHandler(
      smtp as unknown as SmtpService,
      prisma as unknown as PrismaService,
      buildTenant(),
      buildNoOpFactory(),
    ).execute({
      to: 'client@example.com',
      templateSlug: 'welcome',
      vars: { client_name: 'أحمد' },
    });
    expect(smtp.sendMail).toHaveBeenCalledWith(
      'client@example.com',
      'مرحباً',
      '<p>أحمد</p>',
    );
  });

  it('skips when no provider at all (SMTP unavailable + no tenant provider)', async () => {
    const prisma = buildPrisma();
    const smtp = {
      isAvailable: jest.fn().mockReturnValue(false),
      sendMail: jest.fn(),
    };
    await new SendEmailHandler(
      smtp as unknown as SmtpService,
      prisma as unknown as PrismaService,
      buildTenant(),
      buildNoOpFactory(),
    ).execute({
      to: 'client@example.com',
      templateSlug: 'welcome',
      vars: {},
    });
    expect(smtp.sendMail).not.toHaveBeenCalled();
  });

  it('skips when template not found', async () => {
    const prisma = buildPrisma();
    prisma.emailTemplate.findFirst.mockResolvedValue(null);
    const smtp = {
      isAvailable: jest.fn().mockReturnValue(true),
      sendMail: jest.fn(),
    };
    await new SendEmailHandler(
      smtp as unknown as SmtpService,
      prisma as unknown as PrismaService,
      buildTenant(),
      buildNoOpFactory(),
    ).execute({
      to: 'client@example.com',
      templateSlug: 'missing',
      vars: {},
    });
    expect(smtp.sendMail).not.toHaveBeenCalled();
  });
});

describe('SendEmailHandler — interpolation', () => {
  it('skips when template not found', async () => {
    const smtp = { isAvailable: jest.fn().mockReturnValue(true), sendMail: jest.fn() };
    const prisma = { emailTemplate: { findFirst: jest.fn().mockResolvedValue(null) } };
    await new SendEmailHandler(
      smtp as unknown as SmtpService,
      prisma as unknown as PrismaService,
      buildTenant(),
      buildNoOpFactory(),
    ).execute({ to: 'a@b.com', templateSlug: 'missing', vars: {} });
    expect(smtp.sendMail).not.toHaveBeenCalled();
  });

  it('skips when template is inactive', async () => {
    const smtp = { isAvailable: jest.fn().mockReturnValue(true), sendMail: jest.fn() };
    const prisma = { emailTemplate: { findFirst: jest.fn().mockResolvedValue({ isActive: false, htmlBody: '', subject: '' }) } };
    await new SendEmailHandler(
      smtp as unknown as SmtpService,
      prisma as unknown as PrismaService,
      buildTenant(),
      buildNoOpFactory(),
    ).execute({ to: 'a@b.com', templateSlug: 'tpl', vars: {} });
    expect(smtp.sendMail).not.toHaveBeenCalled();
  });

  it('replaces {{vars}} in htmlBody and subject via platform SMTP', async () => {
    const smtp = { isAvailable: jest.fn().mockReturnValue(true), sendMail: jest.fn().mockResolvedValue(undefined) };
    const prisma = {
      emailTemplate: {
        findFirst: jest.fn().mockResolvedValue({
          isActive: true,
          htmlBody: '<p>Hello {{name}}</p>',
          subject: 'مرحبا {{name}}',
        }),
      },
    };
    await new SendEmailHandler(
      smtp as unknown as SmtpService,
      prisma as unknown as PrismaService,
      buildTenant(),
      buildNoOpFactory(),
    ).execute({ to: 'a@b.com', templateSlug: 'tpl', vars: { name: 'Ahmad' } });
    expect(smtp.sendMail).toHaveBeenCalledWith('a@b.com', 'مرحبا Ahmad', '<p>Hello Ahmad</p>');
  });

  it('uses tenant email provider when configured', async () => {
    const smtp = { isAvailable: jest.fn().mockReturnValue(true), sendMail: jest.fn() };
    const prisma = {
      emailTemplate: {
        findFirst: jest.fn().mockResolvedValue({
          isActive: true,
          htmlBody: 'body',
          subject: 'subject',
        }),
      },
    };
    const tenantSendMail = jest.fn().mockResolvedValue({ messageId: 'tenant-msg-1' });
    const tenantFactory = {
      forCurrentTenant: jest.fn().mockResolvedValue({
        isAvailable: () => true,
        sendMail: tenantSendMail,
      }),
    } as unknown as EmailProviderFactory;

    await new SendEmailHandler(
      smtp as unknown as SmtpService,
      prisma as unknown as PrismaService,
      buildTenant(),
      tenantFactory,
    ).execute({ to: 'a@b.com', templateSlug: 'tpl', vars: {} });

    expect(tenantSendMail).toHaveBeenCalled();
    expect(smtp.sendMail).not.toHaveBeenCalled();
  });

  it('does not throw when smtp.sendMail rejects', async () => {
    const smtp = { isAvailable: jest.fn().mockReturnValue(true), sendMail: jest.fn().mockRejectedValue(new Error('SMTP down')) };
    const prisma = {
      emailTemplate: { findFirst: jest.fn().mockResolvedValue({ isActive: true, htmlBody: 'body', subject: 'subj' }) },
    };
    await expect(
      new SendEmailHandler(
        smtp as unknown as SmtpService,
        prisma as unknown as PrismaService,
        buildTenant(),
        buildNoOpFactory(),
      ).execute({ to: 'a@b.com', templateSlug: 'tpl', vars: {} }),
    ).resolves.not.toThrow();
  });
});
