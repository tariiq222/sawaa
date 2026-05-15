import { Test, TestingModule } from '@nestjs/testing';
import { PlatformSettingsService } from './platform-settings.service';
import { PrismaService } from '../../../infrastructure/database';

describe('PlatformSettingsService', () => {
  let service: PlatformSettingsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    process.env.PLATFORM_SETTINGS_KEY = 'a'.repeat(64);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformSettingsService,
        {
          provide: PrismaService,
          useValue: {
            platformSetting: {
              findUnique: jest.fn(),
              upsert: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<PlatformSettingsService>(PlatformSettingsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should get value from DB', async () => {
    (prisma.platformSetting.findUnique as jest.Mock).mockResolvedValue({ key: 'test', value: 'true' });
    const result = await service.get('test');
    expect(result).toBe(true);
  });

  it('should return raw string when not valid JSON', async () => {
    (prisma.platformSetting.findUnique as jest.Mock).mockResolvedValue({ key: 'test', value: 'hello' });
    const result = await service.get('test');
    expect(result).toBe('hello');
  });

  it('should return null when not found', async () => {
    (prisma.platformSetting.findUnique as jest.Mock).mockResolvedValue(null);
    const result = await service.get('test');
    expect(result).toBeNull();
  });

  it('should use env fallback', async () => {
    (prisma.platformSetting.findUnique as jest.Mock).mockResolvedValue(null);
    const result = await service.get('test', 'fallback');
    expect(result).toBe('fallback');
  });

  it('should set value', async () => {
    await service.set('test', 'value');
    expect(prisma.platformSetting.upsert).toHaveBeenCalled();
  });

  it('should invalidate without error', () => {
    expect(() => service.invalidate('test')).not.toThrow();
  });
});
