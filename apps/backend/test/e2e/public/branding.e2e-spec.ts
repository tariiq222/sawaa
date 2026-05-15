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

  it('GET /api/v1/public/branding returns branding config', async () => {
    prisma.brandingConfig.findFirst.mockResolvedValue({
      id: '1',
      primaryColor: '#000000',
      organizationNameAr: 'سوا',
      logoUrl: 'https://cdn.example.com/logo.png',
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/public/branding')
      .expect(200);

    expect(res.body.organizationNameAr).toBe('سوا');
  });
});
