import { INestApplication } from '@nestjs/common';
import { createTestApp, request } from '../helpers/create-test-app';

describe('Smoke — Health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const { app: a } = await createTestApp();
    app = a;
  });

  afterAll(async () => {
    await app.close();
  });

  it('App boots and /health/live responds in < 1s', async () => {
    const start = Date.now();
    const res = await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .expect(200);
    const elapsed = Date.now() - start;

    expect(res.body.status).toBe('ok');
    expect(elapsed).toBeLessThan(1000);
  });
});
