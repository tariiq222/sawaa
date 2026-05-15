import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SmtpService } from './smtp.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({}),
  }),
}));

describe('SmtpService', () => {
  let service: SmtpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmtpService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'SMTP_HOST') return 'smtp.example.com';
              if (key === 'SMTP_PORT') return 587;
              if (key === 'SMTP_FROM') return 'test@example.com';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<SmtpService>(SmtpService);
    service.onModuleInit();
  });

  it('should be available', () => {
    expect(service.isAvailable()).toBe(true);
  });

  it('should send mail', async () => {
    await service.sendMail('to@example.com', 'Subject', '<p>Body</p>');
    // nodemailer mock
  });

  it('should send bulk', async () => {
    await service.sendBulk([
      { to: 'a@example.com', subject: 'A', html: '<p>A</p>' },
      { to: 'b@example.com', subject: 'B', html: '<p>B</p>' },
    ]);
  });

  it('should throw when not available', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmtpService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
      ],
    }).compile();
    const svc = module.get<SmtpService>(SmtpService);
    svc.onModuleInit();
    await expect(svc.sendMail('to@example.com', 'Subject', '<p>Body</p>')).rejects.toThrow('SMTP is not initialized');
  });
});
