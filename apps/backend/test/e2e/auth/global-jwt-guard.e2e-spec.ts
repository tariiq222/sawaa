import { INestApplication } from '@nestjs/common';
import { createTestApp, request } from '../../helpers/create-test-app';

/**
 * R-13: a global JwtGuard (APP_GUARD) authenticates every route by default.
 * Dashboard/admin routes must reject an unauthenticated request with 401;
 * routes decorated @Public() must NOT be rejected by the global guard (they
 * are protected by their own ClientSessionGuard/OtpSessionGuard or are
 * genuinely public). This spec locks that contract so a future controller
 * added without a guard cannot silently become unauthenticated.
 */
describe('Global JWT guard (e2e, R-13)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const { app: a } = await createTestApp();
    app = a;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects an admin/dashboard route with 401 when no token is supplied', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/dashboard/bookings')
      .expect(401);
  });

  it('rejects an admin/dashboard route with 401 for a garbage bearer token', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/dashboard/bookings')
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(401);
  });

  it('does NOT 401 a @Public() route without a token (health is public)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/live');
    expect(res.status).not.toBe(401);
  });

  it('does NOT 401 a @Public() client route guarded by ClientSessionGuard (returns 401/403 from its own guard, not the global admin one)', async () => {
    // public/me uses ClientSessionGuard. Without a client cookie it is rejected
    // by THAT guard. The key assertion is the request reaches the controller's
    // own guard rather than being blocked by the global admin JwtGuard with the
    // admin "Invalid or expired token" message — i.e. @Public() took effect.
    const res = await request(app.getHttpServer()).get('/api/v1/public/me');
    expect([401, 403]).toContain(res.status);
    expect(res.body?.message).not.toBe('Invalid or expired token');
  });
});
