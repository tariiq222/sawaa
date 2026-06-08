import { INestApplication } from '@nestjs/common';
import { createTestApp, request, MockPrisma } from '../../helpers/create-test-app';

describe('Public Branding (e2e)', () => {
  let app: INestApplication;
  let prisma: MockPrisma;

  beforeAll(async () => {
    const { app: a, prisma: p } = await createTestApp();
    app = a;
    prisma = p;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/public/branding returns the org name from settings', async () => {
    prisma.organizationSettings.findFirst.mockResolvedValue({
      companyNameAr: 'سواء',
      companyNameEn: 'Sawaa',
      productTagline: null,
      timeFormat: '12h',
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/public/branding')
      .expect(200);

    expect(res.body.organizationNameAr).toBe('سواء');
  });
});
