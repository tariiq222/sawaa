import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PublicBrandingController } from './branding.controller';
import { GetPublicBrandingHandler } from '../../modules/org-experience/branding/public/get-public-branding.handler';

describe('PublicBrandingController (e2e)', () => {
  let app: INestApplication;

  const mockGetBranding = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PublicBrandingController],
      providers: [
        { provide: GetPublicBrandingHandler, useValue: mockGetBranding },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /public/branding', () => {
    it('returns 200 with branding data', async () => {
      mockGetBranding.execute.mockResolvedValue({
        name: 'My Clinic',
        logo: 'https://cdn.example.com/logo.png',
        primaryColor: '#3B82F6',
      });

      const res = await request(app.getHttpServer())
        .get('/public/branding')
        .expect(200);

      expect(res.body.name).toBe('My Clinic');
      expect(mockGetBranding.execute).toHaveBeenCalled();
    });
  });
});
