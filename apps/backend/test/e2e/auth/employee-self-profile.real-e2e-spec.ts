/** Real HTTP, PostgreSQL and Redis; email/SMS delivery and object storage are test adapters. */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/infrastructure/database';
import { RedisService } from '../../../src/infrastructure/cache/redis.service';
import { TokenService } from '../../../src/modules/identity/shared/token.service';
import { MobileEmailDelivery } from '../../../src/modules/identity/mobile-email-entry/mobile-email-delivery';
import { MinioService } from '../../../src/infrastructure/storage/minio.service';
import { configureHttpContract } from '../../../src/common/bootstrap/configure-http-contract';
import { getRealE2eDatabaseUrl } from '../../helpers/create-real-e2e-app';

const redisPort = process.env.EMPLOYEE_PROFILE_TEST_REDIS_PORT ?? process.env.REDIS_PORT;
const describeReal = process.env.REAL_E2E_DATABASE_URL && redisPort ? describe : describe.skip;
describeReal('Employee own profile — persisted HTTP acceptance', () => {
  jest.setTimeout(60000);
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  let redis: import('ioredis').default;
  const ids: string[] = [];
  const employees: string[] = [];
  const codes = new Map<string, string>();
  const prefix = 'self-profile-' + randomUUID().slice(0, 8);
  const endpoint = '/api/v1/mobile/employee/profile';
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6/9sAAAAASUVORK5CYII=', 'base64');
  const api = (token?: string) => ({
    get: (url = endpoint) => request(app.getHttpServer()).get(url).set('Authorization', token ? `Bearer ${token}` : ''),
    patch: (body: object) => request(app.getHttpServer()).patch(endpoint).set('Authorization', `Bearer ${token}`).send(body),
    post: (url: string, body: object) => request(app.getHttpServer()).post(endpoint + url).set('Authorization', `Bearer ${token}`).send(body),
  });
  beforeAll(async () => {
    process.env.DATABASE_URL = getRealE2eDatabaseUrl();
    const Redis = jest.requireActual('ioredis').default;
    redis = new Redis({ host: '127.0.0.1', port: Number(redisPort), maxRetriesPerRequest: 1 });
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RedisService).useValue({ getClient: () => redis, buildOptions: () => ({ host: '127.0.0.1', port: Number(redisPort) }) })
      .overrideProvider(MobileEmailDelivery).useValue({ send: async (_channel: string, identifier: string, code: string) => { codes.set(identifier, code); } })
      .overrideProvider(MinioService).useValue({
        uploadFile: async (bucket: string, key: string) => `http://minio:9000/${bucket}/${key}`,
        deleteFile: async () => undefined,
        getSignedUrl: async () => 'http://127.0.0.1/internal-signed',
        getFileStream: async () => Readable.from(png),
      })
      .compile();
    app = module.createNestApplication();
    configureHttpContract(app, 'production');
    const document = SwaggerModule.createDocument(app, new DocumentBuilder()
      .setTitle('Sawaa API').setDescription('Sawaa — نظام إدارة الحجوزات والمواعيد — dashboard & mobile API').setVersion('2.0')
      .setContact('Sawaa Engineering', 'https://sawaa.app', 'dev@sawaa.app').setLicense('Proprietary', 'https://sawaa.app/license')
      .addBearerAuth().addServer('http://localhost:5200', 'Local dev').build());
    SwaggerModule.setup('api/docs', app, document);
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService); tokens = app.get(TokenService);
    if (process.env.EMPLOYEE_PROFILE_SYNC_OPENAPI === '1') {
      await promisify(execFile)('pnpm', ['openapi:sync'], { cwd: resolve(process.cwd(), '../..'),
        env: { ...process.env, API_URL: await app.getUrl() }, timeout: 45000 });
    }
  });
  afterAll(async () => {
    try { if (prisma) {
      await prisma.employeeContactChallenge.deleteMany({ where: { userId: { in: ids } } });
      await prisma.file.deleteMany({ where: { uploadedBy: { in: ids } } });
      await prisma.employee.deleteMany({ where: { id: { in: employees } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    } finally {
      if (app) await app.close();
      if (redis) await redis.quit();
    }
  });
  async function account(role: 'EMPLOYEE' | 'CLIENT' = 'EMPLOYEE', linked = true) {
    const email = `${prefix}-${randomUUID()}@example.test`;
    const user = await prisma.user.create({ data: { name: 'Profile fixture', email, role, emailVerifiedAt: new Date() } });
    ids.push(user.id);
    const employee = linked ? await prisma.employee.create({ data: { userId: user.id, name: user.name, nameAr: 'معالج تجريبي', email, isPublic: true } }) : null;
    if (employee) employees.push(employee.id);
    const pair = await tokens.issueTokenPair({ ...user, customRole: null }, {});
    return { user, employee, token: pair.accessToken };
  }
  it('requires a live staff account linked to an active employee', async () => {
    await api().get().expect(401);
    const missing = await account('EMPLOYEE', false);
    await api(missing.token).get().expect(403);
    const client = await account('CLIENT');
    await api(client.token).get().expect(401);
    const staff = await account();
    await prisma.employee.update({ where: { id: staff.employee!.id }, data: { isActive: false } });
    await api(staff.token).get().expect(403);
  });
  it('updates only its own public biography, years and languages and rejects administrative/contact fields', async () => {
    const a = await account(); const b = await account();
    const result = await api(a.token).patch({ bioAr: 'خبرة في الإرشاد', bioEn: 'Counseling experience', experience: 8, languages: [' العربية ', 'English'] }).expect(200);
    expect(result.body).toMatchObject({ id: a.employee!.id, languages: ['العربية', 'English'], experience: 8 });
    const publicProfile = await api().get('/api/v1/public/employees/' + a.employee!.id).expect(200);
    expect(publicProfile.body).toMatchObject({ publicBioAr: 'خبرة في الإرشاد', languages: ['العربية', 'English'], experience: 8 });
    expect(publicProfile.body).not.toHaveProperty('email');
    for (const body of [{ employeeId: b.employee!.id, bioAr: 'spoof' }, { role: 'ADMIN' }, { email: 'new@example.test' }, { phone: '+966509876543' }, { isPublic: false }, { experience: -1 }, { experience: 2.5 }, { languages: [''] }]) await api(a.token).patch(body).expect(400);
    expect((await prisma.employee.findUniqueOrThrow({ where: { id: b.employee!.id } })).publicBioAr).toBeNull();
  });
  it('uploads, replaces and removes a photo from account and public profile, validating actual bytes', async () => {
    const f = await account();
    const upload = () => request(app.getHttpServer()).post(endpoint + '/avatar').set('Authorization', `Bearer ${f.token}`).attach('file', png, { filename: 'photo.png', contentType: 'image/png' });
    const first = await upload().expect(200);
    const firstPath = new URL(first.body.avatarUrl).pathname;
    expect(firstPath).toMatch(/^\/api\/v1\/public\/employees\/images\//);
    await request(app.getHttpServer()).get(firstPath).expect(200).expect('Content-Type', /image\/png/).expect('Cache-Control', 'no-store');
    const storedFirst = await prisma.file.findFirstOrThrow({ where: { uploadedBy: f.user.id } });
    await prisma.file.update({ where: { id: storedFirst.id }, data: { visibility: 'PRIVATE' } });
    await request(app.getHttpServer()).get(firstPath).expect(404);
    await prisma.file.update({ where: { id: storedFirst.id }, data: { visibility: 'PUBLIC' } });
    const second = await upload().expect(200);
    await request(app.getHttpServer()).get(firstPath).expect(404);
    const secondPath = new URL(second.body.avatarUrl).pathname;
    await request(app.getHttpServer()).get(secondPath).expect(200);
    expect(second.body.avatarUrl).not.toBe(first.body.avatarUrl);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: f.user.id } });
    expect(user.avatarUrl).toBe(second.body.avatarUrl);
    const photo = await prisma.file.findFirstOrThrow({ where: { uploadedBy: f.user.id } });
    expect(photo.visibility).toBe('PUBLIC');
    await request(app.getHttpServer()).post(endpoint + '/avatar').set('Authorization', `Bearer ${f.token}`).attach('file', Buffer.from('not an image'), { filename: 'fake.png', contentType: 'image/png' }).expect(400);
    await request(app.getHttpServer()).post(endpoint + '/avatar').set('Authorization', `Bearer ${f.token}`).attach('file', Buffer.alloc(1048577), { filename: 'large.png', contentType: 'image/png' }).expect(413);
    const removed = await request(app.getHttpServer()).delete(endpoint + '/avatar').set('Authorization', `Bearer ${f.token}`).expect(200);
    expect(removed.body.avatarUrl).toBeNull();
    await request(app.getHttpServer()).get(secondPath).expect(404);
    expect((await prisma.employee.findUniqueOrThrow({ where: { id: f.employee!.id } })).publicImageUrl).toBeNull();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: f.user.id } })).avatarUrl).toBeNull();
  });
  it('changes the login email only after proof and consumes a challenge once under concurrent verification', async () => {
    const f = await account(); const other = await account();
    const identifier = `${prefix}-new-${randomUUID()}@example.test`;
    const challenge = await api(f.token).post('/contact/request', { channel: 'EMAIL', identifier }).expect(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: f.user.id } })).email).toBe(f.user.email);
    const proof = { challengeId: challenge.body.challengeId, code: codes.get(identifier) };
    await api(other.token).post('/contact/verify', proof).expect(400);
    const results = await Promise.all([api(f.token).post('/contact/verify', proof), api(f.token).post('/contact/verify', proof)]);
    expect(results.map(r => r.status).sort()).toEqual([200, 400]);
    const saved = await prisma.user.findUniqueOrThrow({ where: { id: f.user.id } });
    expect(saved.email).toBe(identifier); expect(saved.emailVerifiedAt).not.toBeNull();
    expect((await prisma.employee.findUniqueOrThrow({ where: { id: f.employee!.id } })).email).toBe(identifier);
    await api(f.token).get().expect(200); // Existing sessions continue using the live account identity.
  });
  it('normalizes and verifies a phone number, without changing the previous email', async () => {
    const f = await account(); const phone = '+966509876543';
    const challenge = await api(f.token).post('/contact/request', { channel: 'SMS', identifier: '0509876543' }).expect(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: f.user.id } })).phone).toBeNull();
    const confirmed = await api(f.token).post('/contact/verify', { challengeId: challenge.body.challengeId, code: codes.get(phone) }).expect(200);
    expect(confirmed.body.phone).toBe(phone);
    const saved = await prisma.user.findUniqueOrThrow({ where: { id: f.user.id } });
    expect(saved.phoneVerifiedAt).not.toBeNull(); expect(saved.email).toBe(f.user.email);
  });
  it('rejects duplicate contacts, persists bad attempts, blocks exhausted codes and enforces the send cooldown', async () => {
    const f = await account(); const other = await account();
    await api(f.token).post('/contact/request', { channel: 'EMAIL', identifier: other.user.email.toUpperCase() }).expect(409);
    const identifier = `${prefix}-attempt-${randomUUID().slice(0, 8)}@example.test`;
    const c = await api(f.token).post('/contact/request', { channel: 'EMAIL', identifier }).expect(200);
    await api(f.token).post('/contact/request', { channel: 'EMAIL', identifier: `${prefix}-another@example.test` }).expect(429);
    const code = codes.get(identifier);
    for (let i = 0; i < 5; i++) await api(f.token).post('/contact/verify', { challengeId: c.body.challengeId, code: code === '000000' ? '111111' : '000000' }).expect(400);
    expect((await prisma.employeeContactChallenge.findUniqueOrThrow({ where: { id: c.body.challengeId } })).attempts).toBe(5);
    await api(f.token).post('/contact/verify', { challengeId: c.body.challengeId, code }).expect(400);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: f.user.id } })).email).toBe(f.user.email);
  });
});
