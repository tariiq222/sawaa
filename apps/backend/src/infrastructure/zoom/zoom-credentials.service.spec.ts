import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ZoomCredentialsService } from './zoom-credentials.service';

describe('ZoomCredentialsService', () => {
  let service: ZoomCredentialsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ZoomCredentialsService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(Buffer.alloc(32).toString('base64')) } },
      ],
    }).compile();

    service = module.get<ZoomCredentialsService>(ZoomCredentialsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should encrypt and decrypt payload', () => {
    const payload = { accountId: 'acc', clientId: 'cli' };
    const encrypted = service.encrypt(payload, 'org-1');
    expect(typeof encrypted).toBe('string');
    const decrypted = service.decrypt(encrypted, 'org-1');
    expect(decrypted).toEqual(payload);
  });

  it('should throw when key is missing', () => {
    expect(() => {
      new ZoomCredentialsService({ get: () => undefined } as any);
    }).toThrow();
  });

  it('should throw when key is wrong length', () => {
    expect(() => {
      new ZoomCredentialsService({ get: () => Buffer.alloc(16).toString('base64') } as any);
    }).toThrow();
  });

  it('should throw on invalid ciphertext length', () => {
    expect(() => service.decrypt('short', 'org-1')).toThrow('Invalid ciphertext length');
  });
});
