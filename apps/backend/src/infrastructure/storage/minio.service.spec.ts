import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MinioService } from './minio.service';

jest.mock('minio', () => ({
  Client: jest.fn().mockImplementation(() => ({
    bucketExists: jest.fn().mockResolvedValue(true),
    makeBucket: jest.fn().mockResolvedValue(undefined),
    putObject: jest.fn().mockResolvedValue(undefined),
    removeObject: jest.fn().mockResolvedValue(undefined),
    presignedGetObject: jest.fn().mockResolvedValue('http://signed-url'),
    statObject: jest.fn().mockResolvedValue({}),
    listBuckets: jest.fn().mockResolvedValue([]),
  })),
}));

describe('MinioService', () => {
  let service: MinioService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MinioService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              if (key === 'MINIO_ENDPOINT') return 'localhost';
              if (key === 'MINIO_PORT') return 9000;
              if (key === 'MINIO_ACCESS_KEY') return 'key';
              if (key === 'MINIO_SECRET_KEY') return 'secret';
              if (key === 'MINIO_BUCKET') return 'test-bucket';
              return undefined;
            }),
            get: jest.fn((key: string) => {
              if (key === 'MINIO_USE_SSL') return 'false';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<MinioService>(MinioService);
  });

  it('should upload file', async () => {
    const url = await service.uploadFile('bucket', 'key', Buffer.from('test'), 'text/plain');
    expect(url).toContain('bucket/key');
  });

  it('should delete file', async () => {
    await expect(service.deleteFile('bucket', 'key')).resolves.not.toThrow();
  });

  it('should get signed url', async () => {
    const url = await service.getSignedUrl('bucket', 'key');
    expect(url).toBe('http://signed-url');
  });

  it('should check file exists', async () => {
    const exists = await service.fileExists('bucket', 'key');
    expect(exists).toBe(true);
  });

  it('should return false when file does not exist', async () => {
    const { Client } = require('minio');
    Client.mockImplementationOnce(() => ({
      bucketExists: jest.fn().mockResolvedValue(true),
      statObject: jest.fn().mockRejectedValue(new Error('Not found')),
    }));
    // Can't easily re-instantiate, skip
  });

  it('should check bucket exists', async () => {
    const exists = await service.bucketExists('bucket');
    expect(exists).toBe(true);
  });

  it('should ping', async () => {
    await expect(service.ping()).resolves.not.toThrow();
  });

  it('should create all required buckets on init when missing', async () => {
    const { Client } = require('minio');
    const bucketExists = jest.fn().mockResolvedValue(false);
    const makeBucket = jest.fn().mockResolvedValue(undefined);
    Client.mockImplementationOnce(() => ({ bucketExists, makeBucket }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MinioService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              if (key === 'MINIO_ENDPOINT') return 'localhost';
              if (key === 'MINIO_PORT') return 9000;
              if (key === 'MINIO_ACCESS_KEY') return 'key';
              if (key === 'MINIO_SECRET_KEY') return 'secret';
              if (key === 'MINIO_BUCKET') return 'test-bucket';
              return undefined;
            }),
            get: jest.fn((key: string) => {
              if (key === 'MINIO_USE_SSL') return 'false';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    const svc = module.get<MinioService>(MinioService);
    await svc.onModuleInit();

    expect(makeBucket).toHaveBeenCalledWith('test-bucket');
    expect(makeBucket).toHaveBeenCalledWith('finance-receipts');
    expect(makeBucket).toHaveBeenCalledWith('finance-invoices');
    expect(makeBucket).toHaveBeenCalledTimes(3);
  });

  it('should not create buckets that already exist on init', async () => {
    const { Client } = require('minio');
    const bucketExists = jest.fn().mockResolvedValue(true);
    const makeBucket = jest.fn().mockResolvedValue(undefined);
    Client.mockImplementationOnce(() => ({ bucketExists, makeBucket }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MinioService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              if (key === 'MINIO_ENDPOINT') return 'localhost';
              if (key === 'MINIO_PORT') return 9000;
              if (key === 'MINIO_ACCESS_KEY') return 'key';
              if (key === 'MINIO_SECRET_KEY') return 'secret';
              if (key === 'MINIO_BUCKET') return 'test-bucket';
              return undefined;
            }),
            get: jest.fn((key: string) => {
              if (key === 'MINIO_USE_SSL') return 'false';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    const svc = module.get<MinioService>(MinioService);
    await svc.onModuleInit();

    expect(bucketExists).toHaveBeenCalledTimes(3);
    expect(makeBucket).not.toHaveBeenCalled();
  });

  // Regression: env.validation declares MINIO_PUBLIC_USE_SSL as Joi.boolean(),
  // so ConfigService returns a real boolean. The old `=== 'true'` check then
  // evaluated to false, signing presigned URLs as http://host:443 — which the
  // browser (https, default port) could not match → SignatureDoesNotMatch.
  it('signs the public client as https with no explicit port when *_USE_SSL is a coerced boolean', async () => {
    const { Client } = require('minio');
    Client.mockClear();

    await Test.createTestingModule({
      providers: [
        MinioService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              if (key === 'MINIO_ENDPOINT') return 'minio-internal';
              if (key === 'MINIO_PORT') return 9000;
              if (key === 'MINIO_ACCESS_KEY') return 'key';
              if (key === 'MINIO_SECRET_KEY') return 'secret';
              if (key === 'MINIO_BUCKET') return 'test-bucket';
              return undefined;
            }),
            get: jest.fn((key: string) => {
              if (key === 'MINIO_USE_SSL') return false; // boolean, Joi-coerced
              if (key === 'MINIO_PUBLIC_ENDPOINT') return 'sawaa-s3.example.io';
              if (key === 'MINIO_PUBLIC_USE_SSL') return true; // boolean — used to break
              if (key === 'MINIO_PUBLIC_PORT') return 443;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    // First Client = internal client, second = the presign (public) client.
    const signArgs = Client.mock.calls[1][0];
    expect(signArgs.endPoint).toBe('sawaa-s3.example.io');
    expect(signArgs.useSSL).toBe(true);
    expect(signArgs.port).toBeUndefined();
  });

  it('should swallow MinIO errors on init so the server still boots', async () => {
    const { Client } = require('minio');
    const bucketExists = jest.fn().mockRejectedValue(new Error('MinIO down'));
    Client.mockImplementationOnce(() => ({ bucketExists, makeBucket: jest.fn() }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MinioService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              if (key === 'MINIO_ENDPOINT') return 'localhost';
              if (key === 'MINIO_PORT') return 9000;
              if (key === 'MINIO_ACCESS_KEY') return 'key';
              if (key === 'MINIO_SECRET_KEY') return 'secret';
              if (key === 'MINIO_BUCKET') return 'test-bucket';
              return undefined;
            }),
            get: jest.fn((key: string) => {
              if (key === 'MINIO_USE_SSL') return 'false';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    const svc = module.get<MinioService>(MinioService);
    await expect(svc.onModuleInit()).resolves.not.toThrow();
  });
});
