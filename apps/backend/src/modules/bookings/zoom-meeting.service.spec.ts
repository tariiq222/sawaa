import { Test, TestingModule } from '@nestjs/testing';
import { ZoomMeetingService } from './zoom-meeting.service';
import { PrismaService } from '../../infrastructure/database';
import { ZoomApiClient } from '../../infrastructure/zoom/zoom-api.client';
import { ZoomCredentialsService } from '../../infrastructure/zoom/zoom-credentials.service';

describe('ZoomMeetingService', () => {
  let service: ZoomMeetingService;
  let prisma: PrismaService;
  let zoomApi: ZoomApiClient;
  let zoomCredentials: ZoomCredentialsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ZoomMeetingService,
        {
          provide: PrismaService,
          useValue: {
            integration: { findFirst: jest.fn() },
            organizationSettings: { findFirst: jest.fn().mockResolvedValue({ timezone: 'Asia/Riyadh' }) },
          },
        },
        {
          provide: ZoomApiClient,
          useValue: {
            getAccessToken: jest.fn().mockResolvedValue('token-123'),
            deleteMeeting: jest.fn().mockResolvedValue(undefined),
            updateMeeting: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ZoomCredentialsService,
          useValue: {
            decrypt: jest.fn().mockReturnValue({ zoomClientId: 'cid', zoomClientSecret: 'csec', zoomAccountId: 'aid' }),
          },
        },
      ],
    }).compile();

    service = module.get<ZoomMeetingService>(ZoomMeetingService);
    prisma = module.get<PrismaService>(PrismaService);
    zoomApi = module.get<ZoomApiClient>(ZoomApiClient);
    zoomCredentials = module.get<ZoomCredentialsService>(ZoomCredentialsService);
  });

  it('should get access token', async () => {
    (prisma.integration.findFirst as jest.Mock).mockResolvedValue({ provider: 'zoom', isActive: true, config: { ciphertext: 'enc' } });
    const token = await service.getAccessToken('org-1');
    expect(token).toBe('token-123');
  });

  it('should return null when integration not found', async () => {
    (prisma.integration.findFirst as jest.Mock).mockResolvedValue(null);
    const token = await service.getAccessToken('org-1');
    expect(token).toBeNull();
  });

  it('should return null when integration inactive', async () => {
    (prisma.integration.findFirst as jest.Mock).mockResolvedValue({ provider: 'zoom', isActive: false });
    const token = await service.getAccessToken('org-1');
    expect(token).toBeNull();
  });

  it('should return null when no ciphertext', async () => {
    (prisma.integration.findFirst as jest.Mock).mockResolvedValue({ provider: 'zoom', isActive: true, config: {} });
    const token = await service.getAccessToken('org-1');
    expect(token).toBeNull();
  });

  it('should return null on decrypt error', async () => {
    (prisma.integration.findFirst as jest.Mock).mockResolvedValue({ provider: 'zoom', isActive: true, config: { ciphertext: 'enc' } });
    (zoomCredentials.decrypt as jest.Mock).mockImplementation(() => { throw new Error('Decrypt failed'); });
    const token = await service.getAccessToken('org-1');
    expect(token).toBeNull();
  });

  it('should delete meeting', async () => {
    (prisma.integration.findFirst as jest.Mock).mockResolvedValue({ provider: 'zoom', isActive: true, config: { ciphertext: 'enc' } });
    await service.deleteMeeting('org-1', '123');
    expect(zoomApi.deleteMeeting).toHaveBeenCalledWith('token-123', '123');
  });

  it('should skip delete when no token', async () => {
    (prisma.integration.findFirst as jest.Mock).mockResolvedValue(null);
    await service.deleteMeeting('org-1', '123');
    expect(zoomApi.deleteMeeting).not.toHaveBeenCalled();
  });

  it('should update meeting', async () => {
    (prisma.integration.findFirst as jest.Mock).mockResolvedValue({ provider: 'zoom', isActive: true, config: { ciphertext: 'enc' } });
    await service.updateMeeting('org-1', '123', { topic: 'Test', startTime: '2024-01-01T10:00:00Z', durationMins: 30 });
    expect(zoomApi.updateMeeting).toHaveBeenCalled();
  });

  it('should use default timezone when not set', async () => {
    (prisma.integration.findFirst as jest.Mock).mockResolvedValue({ provider: 'zoom', isActive: true, config: { ciphertext: 'enc' } });
    (prisma.organizationSettings.findFirst as jest.Mock).mockResolvedValue(null);
    await service.updateMeeting('org-1', '123', { topic: 'Test', startTime: '2024-01-01T10:00:00Z', durationMins: 30 });
    expect(zoomApi.updateMeeting).toHaveBeenCalledWith('token-123', '123', expect.anything(), 'Asia/Riyadh');
  });
});
