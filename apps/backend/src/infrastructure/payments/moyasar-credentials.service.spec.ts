import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MoyasarCredentialsService } from './moyasar-credentials.service';

describe('MoyasarCredentialsService', () => {
  let service: MoyasarCredentialsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MoyasarCredentialsService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(Buffer.alloc(32).toString('base64')) } },
      ],
    }).compile();

    service = module.get<MoyasarCredentialsService>(MoyasarCredentialsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should encrypt and decrypt payload', () => {
    const payload = { secretKey: 'sk_test' };
    const encrypted = service.encrypt(payload, 'org-1');
    expect(typeof encrypted).toBe('string');
    const decrypted = service.decrypt(encrypted, 'org-1');
    expect(decrypted).toEqual(payload);
  });

  it('should throw when key is missing', () => {
    expect(() => {
      new MoyasarCredentialsService({ get: () => undefined } as any);
    }).toThrow();
  });

  it('should throw when key is wrong length', () => {
    expect(() => {
      new MoyasarCredentialsService({ get: () => Buffer.alloc(16).toString('base64') } as any);
    }).toThrow();
  });
});
