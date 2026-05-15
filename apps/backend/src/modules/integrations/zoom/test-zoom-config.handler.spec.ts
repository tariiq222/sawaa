import { Test } from '@nestjs/testing';
import { TestZoomConfigHandler } from './test-zoom-config.handler';
import { ZoomApiClient } from '../../../infrastructure/zoom/zoom-api.client';
import { ZoomCredentialsService } from '../../../infrastructure/zoom/zoom-credentials.service';
import { PrismaService } from '../../../infrastructure/database';

describe('TestZoomConfigHandler', () => {
  let handler: TestZoomConfigHandler;
  let prisma: any;
  let zoomCredentials: any;
  let zoomApi: any;

  beforeEach(async () => {
    prisma = { integration: { findUnique: jest.fn() } };
    zoomCredentials = { decrypt: jest.fn() };
    zoomApi = { getAccessToken: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        TestZoomConfigHandler,
        { provide: ZoomApiClient, useValue: zoomApi },
        { provide: ZoomCredentialsService, useValue: zoomCredentials },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get(TestZoomConfigHandler);
  });

  it('should be defined', () => expect(handler).toBeDefined());

  it('should return ok when all credentials provided and token succeeds', async () => {
    zoomApi.getAccessToken.mockResolvedValue('token');
    const result = await handler.execute({ zoomClientId: 'id', zoomClientSecret: 'secret', zoomAccountId: 'acc' } as any);
    expect(result.ok).toBe(true);
  });

  it('should return error when token fails', async () => {
    zoomApi.getAccessToken.mockRejectedValue(new Error('invalid creds'));
    const result = await handler.execute({ zoomClientId: 'id', zoomClientSecret: 'secret', zoomAccountId: 'acc' } as any);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('invalid creds');
  });

  it('should return error for unknown error type', async () => {
    zoomApi.getAccessToken.mockRejectedValue('string error');
    const result = await handler.execute({ zoomClientId: 'id', zoomClientSecret: 'secret', zoomAccountId: 'acc' } as any);
    expect(result.error).toBe('Unknown error');
  });

  it('should return error when missing credentials and no stored config', async () => {
    prisma.integration.findUnique.mockResolvedValue(null);
    const result = await handler.execute({ zoomClientId: '' } as any);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Missing Zoom credentials');
  });

  it('should fill missing fields from stored config', async () => {
    prisma.integration.findUnique.mockResolvedValue({
      config: { ciphertext: 'cipher' },
    });
    zoomCredentials.decrypt.mockReturnValue({ zoomClientId: 'stored-id', zoomClientSecret: 'stored-secret', zoomAccountId: 'stored-acc' });
    zoomApi.getAccessToken.mockResolvedValue('token');

    const result = await handler.execute({ zoomClientId: 'id' } as any);
    expect(result.ok).toBe(true);
    expect(zoomCredentials.decrypt).toHaveBeenCalledWith('cipher', expect.any(String));
  });

  it('should fall back to stored values only for missing fields', async () => {
    prisma.integration.findUnique.mockResolvedValue({
      config: { ciphertext: 'cipher' },
    });
    zoomCredentials.decrypt.mockReturnValue({ zoomClientId: 'stored-id', zoomClientSecret: 'stored-secret', zoomAccountId: 'stored-acc' });
    zoomApi.getAccessToken.mockResolvedValue('token');

    await handler.execute({ zoomClientId: 'new-id', zoomClientSecret: 'new-secret' } as any);
    expect(zoomApi.getAccessToken).toHaveBeenCalledWith(expect.any(String), 'new-id', 'new-secret', 'stored-acc');
  });

  it('should use empty string when stored value missing', async () => {
    prisma.integration.findUnique.mockResolvedValue({
      config: { ciphertext: 'cipher' },
    });
    zoomCredentials.decrypt.mockReturnValue({ zoomClientId: 'stored-id' });
    zoomApi.getAccessToken.mockResolvedValue('token');

    const result = await handler.execute({ zoomClientId: 'id' } as any);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Missing Zoom credentials');
  });

  it('should handle stored config without ciphertext', async () => {
    prisma.integration.findUnique.mockResolvedValue({ config: { other: 'value' } });
    const result = await handler.execute({} as any);
    expect(result.ok).toBe(false);
  });
});
