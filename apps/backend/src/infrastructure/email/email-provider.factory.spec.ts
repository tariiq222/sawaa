import { Test, TestingModule } from '@nestjs/testing';
import { EmailProviderFactory } from './email-provider.factory';
import { PrismaService } from '../database/prisma.service';
import { EmailCredentialsService } from './email-credentials.service';

describe('EmailProviderFactory', () => {
  let factory: EmailProviderFactory;
  let prisma: PrismaService;
  let credentials: EmailCredentialsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailProviderFactory,
        {
          provide: PrismaService,
          useValue: {
            organizationEmailConfig: { findFirst: jest.fn() },
          },
        },
        {
          provide: EmailCredentialsService,
          useValue: {
            decrypt: jest.fn().mockReturnValue({}),
          },
        },
      ],
    }).compile();

    factory = module.get<EmailProviderFactory>(EmailProviderFactory);
    prisma = module.get<PrismaService>(PrismaService);
    credentials = module.get<EmailCredentialsService>(EmailCredentialsService);
  });

  it('should return NoOp when no config', async () => {
    (prisma.organizationEmailConfig.findFirst as jest.Mock).mockResolvedValue(null);
    const provider = await factory.resolve();
    expect(provider.name).toBe('NONE');
  });

  it('should return NoOp when provider is NONE', async () => {
    (prisma.organizationEmailConfig.findFirst as jest.Mock).mockResolvedValue({ provider: 'NONE' });
    const provider = await factory.resolve();
    expect(provider.name).toBe('NONE');
  });

  it('should return NoOp when no ciphertext', async () => {
    (prisma.organizationEmailConfig.findFirst as jest.Mock).mockResolvedValue({ provider: 'SMTP', credentialsCiphertext: null });
    const provider = await factory.resolve();
    expect(provider.name).toBe('NONE');
  });

  it('should return SMTP adapter', async () => {
    (prisma.organizationEmailConfig.findFirst as jest.Mock).mockResolvedValue({ provider: 'SMTP', credentialsCiphertext: 'enc', senderName: 'Test', senderEmail: 'test@example.com' });
    const provider = await factory.resolve();
    expect(provider.name).toBe('SMTP');
  });

  it('should return RESEND adapter', async () => {
    (prisma.organizationEmailConfig.findFirst as jest.Mock).mockResolvedValue({ provider: 'RESEND', credentialsCiphertext: 'enc' });
    const provider = await factory.resolve();
    expect(provider.name).toBe('RESEND');
  });

  it('should return SENDGRID adapter', async () => {
    (prisma.organizationEmailConfig.findFirst as jest.Mock).mockResolvedValue({ provider: 'SENDGRID', credentialsCiphertext: 'enc' });
    const provider = await factory.resolve();
    expect(provider.name).toBe('SENDGRID');
  });

  it('should return MAILCHIMP adapter', async () => {
    (prisma.organizationEmailConfig.findFirst as jest.Mock).mockResolvedValue({ provider: 'MAILCHIMP', credentialsCiphertext: 'enc' });
    const provider = await factory.resolve();
    expect(provider.name).toBe('MAILCHIMP');
  });

  it('should return NoOp for unknown provider', async () => {
    (prisma.organizationEmailConfig.findFirst as jest.Mock).mockResolvedValue({ provider: 'UNKNOWN', credentialsCiphertext: 'enc' });
    const provider = await factory.resolve();
    expect(provider.name).toBe('NONE');
  });
});
