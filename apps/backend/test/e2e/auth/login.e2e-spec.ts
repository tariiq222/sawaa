import { INestApplication } from '@nestjs/common';
import { createTestApp, request, MockPrisma } from '../../helpers/create-test-app';

describe('Auth / Login (e2e)', () => {
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

  it('POST /api/v1/public/auth/login returns 401 for invalid credentials', async () => {
    prisma.client.findFirst.mockResolvedValue(null);

    await request(app.getHttpServer())
      .post('/api/v1/public/auth/login')
      .send({ email: 'bad@example.com', password: 'wrongpass1' })
      .expect(401);
  });

  it('POST /api/v1/public/auth/login validates password length', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/public/auth/login')
      .send({ email: 'a@b.com', password: 'short' })
      .expect(400);
  });
});
