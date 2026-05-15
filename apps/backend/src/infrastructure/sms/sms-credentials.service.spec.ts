import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SmsCredentialsService } from './sms-credentials.service';

describe('SmsCredentialsService', () => {
  let service: SmsCredentialsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsCredentialsService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(Buffer.alloc(32).toString('base64')) } },
      ],
    }).compile();

    service = module.get<SmsCredentialsService>(SmsCredentialsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should encrypt and decrypt payload', () => {
    const payload = { apiKey: 'secret', sender: 'TEST' };
    const encrypted = service.encrypt(payload, 'org-1');
    expect(typeof encrypted).toBe('string');
    const decrypted = service.decrypt(encrypted, 'org-1');
    expect(decrypted).toEqual(payload);
  });

  it('should throw when key is missing', () => {
    expect(() => {
      new SmsCredentialsService({ get: () => undefined } as any);
    }).toThrow();
  });

  it('should throw when key is wrong length', () => {
    expect(() => {
      new SmsCredentialsService({ get: () => Buffer.alloc(16).toString('base64') } as any);
    }).toThrow();
  });
});
