import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailCredentialsService } from './email-credentials.service';

describe('EmailCredentialsService', () => {
  let service: EmailCredentialsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailCredentialsService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(Buffer.alloc(32).toString('base64')) } },
      ],
    }).compile();

    service = module.get<EmailCredentialsService>(EmailCredentialsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should encrypt and decrypt payload', () => {
    const payload = { host: 'smtp.example.com', port: 587 };
    const encrypted = service.encrypt(payload, 'org-1');
    expect(typeof encrypted).toBe('string');
    const decrypted = service.decrypt(encrypted, 'org-1');
    expect(decrypted).toEqual(payload);
  });

  it('should throw when key is missing', () => {
    expect(() => {
      new EmailCredentialsService({ get: () => undefined } as any);
    }).toThrow();
  });

  it('should throw when key is wrong length', () => {
    expect(() => {
      new EmailCredentialsService({ get: () => Buffer.alloc(16).toString('base64') } as any);
    }).toThrow();
  });
});
