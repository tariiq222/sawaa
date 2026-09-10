import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../src/infrastructure/database';
import { createRealE2eApp, request } from '../../helpers/create-real-e2e-app';

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL
  ? describe
  : describe.skip;

describeRealE2e('Production HTTP contract (real e2e)', () => {
  jest.setTimeout(60_000);

  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let userId: string;
  let authToken: string;

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `production-validation-${suffix}@sawaa.test`;

  beforeAll(async () => {
    const testApp = await createRealE2eApp();
    app = testApp.app;
    prisma = testApp.prisma;
    jwtService = app.get(JwtService);

    const user = await prisma.user.create({
      data: {
        email,
        name: 'Production validation e2e fixture',
        passwordHash: null,
        role: 'ADMIN',
        isActive: true,
      },
    });
    userId = user.id;
    authToken = jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      isSuperAdmin: true,
    });
  });

  afterAll(async () => {
    if (prisma && userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    if (app) await app.close();
  });

  it('serves health at /api/v1 and does not register a doubled version prefix', async () => {
    await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);
    await request(app.getHttpServer()).get('/api/v1/v1/health/live').expect(404);
  });

  it('rejects a numeric string at the production collection endpoint before handler execution', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/dashboard/finance/bookings/00000000-0000-4000-a000-000000000099/collect')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ method: 'CASH', amount: '1000' });

    expect(response.status).toBe(400);
    expect(response.body.message).toEqual(expect.arrayContaining([
      expect.stringContaining('amount'),
    ]));
  });

  it('accepts a numeric amount and reaches the collection handler with a number', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/dashboard/finance/bookings/00000000-0000-4000-a000-000000000099/collect')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ method: 'CASH', amount: 1000 });

    expect(response.status).toBe(404);
  });

  it('rejects an unknown collection field before handler execution', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/dashboard/finance/bookings/00000000-0000-4000-a000-000000000099/collect')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ method: 'CASH', unexpected: 'should fail' });

    expect(response.status).toBe(400);
    expect(response.body.message).toEqual(expect.arrayContaining([
      expect.stringContaining('unexpected'),
    ]));
  });

  it('preserves boolean false for the booking DTO and rejects the string "false"', async () => {
    const body = {
      branchId: '00000000-0000-4000-a000-000000000001',
      clientId: '00000000-0000-4000-a000-000000000002',
      employeeId: '00000000-0000-4000-a000-000000000003',
      serviceId: '00000000-0000-4000-a000-000000000004',
      scheduledAt: '2099-09-05T12:00:00.000Z',
    };

    const falseResponse = await request(app.getHttpServer())
      .post('/api/v1/dashboard/bookings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ ...body, payAtClinic: false });
    expect(falseResponse.status).toBe(404);

    const stringResponse = await request(app.getHttpServer())
      .post('/api/v1/dashboard/bookings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ ...body, payAtClinic: 'false' });
    expect(stringResponse.status).toBe(400);
    expect(stringResponse.body.message).toEqual(expect.arrayContaining([
      expect.stringContaining('payAtClinic'),
    ]));
  });
});
