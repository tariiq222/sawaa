import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UpsertBrandingHandler } from './upsert-branding.handler';
import { PrismaService } from '../../../infrastructure/database';
import * as sanitizers from './branding-sanitizers';

describe('UpsertBrandingHandler', () => {
  let handler: UpsertBrandingHandler;
  let prisma: { brandingConfig: { findFirst: jest.Mock; update: jest.Mock; create: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      brandingConfig: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: '1' }),
        create: jest.fn().mockResolvedValue({ id: '2' }),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        UpsertBrandingHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get(UpsertBrandingHandler);
  });

  it('updates existing config', async () => {
    prisma.brandingConfig.findFirst.mockResolvedValue({ id: '1' });
    const result = await handler.execute({ organizationNameAr: 'عيادة', colorPrimary: '#000000' });
    expect(prisma.brandingConfig.update).toHaveBeenCalled();
    expect(result.id).toBe('1');
  });

  it('creates new config when none exists', async () => {
    prisma.brandingConfig.findFirst.mockResolvedValue(null);
    const result = await handler.execute({ organizationNameAr: 'عيادة', colorPrimary: '#000000' });
    expect(prisma.brandingConfig.create).toHaveBeenCalled();
    expect(result.id).toBe('2');
  });

  it('creates with provided organizationNameAr', async () => {
    prisma.brandingConfig.findFirst.mockResolvedValue(null);
    await handler.execute({ organizationNameAr: 'سوا', colorPrimary: '#000000' });
    expect(prisma.brandingConfig.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ organizationNameAr: 'سوا' }) }),
    );
  });

  it('validates logoUrl and throws on invalid', async () => {
    jest.spyOn(sanitizers, 'validateAssetUrl').mockReturnValue({ ok: false, reason: 'bad host' });
    await expect(handler.execute({ organizationNameAr: 'عيادة', logoUrl: 'http://evil.com/logo.png' })).rejects.toThrow(BadRequestException);
  });

  it('validates faviconUrl and throws on invalid', async () => {
    jest.spyOn(sanitizers, 'validateAssetUrl').mockReturnValue({ ok: false, reason: 'bad host' });
    await expect(handler.execute({ organizationNameAr: 'عيادة', faviconUrl: 'http://evil.com/fav.ico' })).rejects.toThrow(BadRequestException);
  });

  it('validates fontUrl and throws on invalid', async () => {
    jest.spyOn(sanitizers, 'validateAssetUrl').mockReturnValue({ ok: false, reason: 'bad host' });
    await expect(handler.execute({ organizationNameAr: 'عيادة', fontUrl: 'http://evil.com/font.woff' })).rejects.toThrow(BadRequestException);
  });

  it('validates customCss and throws on invalid', async () => {
    jest.spyOn(sanitizers, 'sanitizeCustomCss').mockReturnValue({ ok: false, reason: 'bad css' });
    await expect(handler.execute({ organizationNameAr: 'عيادة', customCss: 'body { color: red; }' })).rejects.toThrow(BadRequestException);
  });

  it('passes through valid assets', async () => {
    jest.spyOn(sanitizers, 'validateAssetUrl').mockReturnValue({ ok: true });
    jest.spyOn(sanitizers, 'sanitizeCustomCss').mockReturnValue({ ok: true });
    prisma.brandingConfig.findFirst.mockResolvedValue({ id: '1' });
    const result = await handler.execute({
      organizationNameAr: 'عيادة',
      logoUrl: 'https://valid.com/logo.png',
      faviconUrl: 'https://valid.com/fav.ico',
      fontUrl: 'https://valid.com/font.woff',
      customCss: 'body {}',
    });
    expect(result.id).toBe('1');
  });
});
