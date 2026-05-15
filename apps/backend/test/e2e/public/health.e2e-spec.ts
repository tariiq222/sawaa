import { INestApplication } from '@nestjs/common';
import { createTestApp, request } from '../../helpers/create-test-app';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const { app: a } = await createTestApp();
    app = a;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health/live returns 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .expect(200);

    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });

  it('GET /api/v1/health/ready returns 200 when healthy', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(200);

    expect(res.body.status).toBeDefined();
  });

  it('GET /api/v1/health returns 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    expect(res.body.status).toBeDefined();
  });
});
