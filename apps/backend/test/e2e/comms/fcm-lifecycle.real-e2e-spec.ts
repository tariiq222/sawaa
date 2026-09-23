import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/infrastructure/database';
import { RegisterFcmTokenHandler } from '../../../src/modules/comms/fcm-tokens/register-fcm-token.handler';
import { UnregisterFcmTokenHandler } from '../../../src/modules/comms/fcm-tokens/unregister-fcm-token.handler';
import { RequestAccountDeletionHandler } from '../../../src/modules/identity/request-account-deletion/request-account-deletion.handler';

const describeReal = process.env.REAL_E2E_DATABASE_URL ? describe : describe.skip;
describeReal('FCM device lifecycle with account closure — real Postgres', () => {
  jest.setTimeout(60000);
  let app: INestApplication;
  let prisma: PrismaService;
  let register: RegisterFcmTokenHandler;
  let unregister: UnregisterFcmTokenHandler;
  let close: RequestAccountDeletionHandler;
  const ids: string[] = [];
  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.REAL_E2E_DATABASE_URL!;
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    register = app.get(RegisterFcmTokenHandler);
    unregister = app.get(UnregisterFcmTokenHandler);
    close = app.get(RequestAccountDeletionHandler);
  });
  afterAll(async () => {
    if (prisma) {
      await prisma.fcmToken.deleteMany({ where: { clientId: { in: ids } } });
      await prisma.client.deleteMany({ where: { id: { in: ids } } });
    }
    if (app) await app.close();
  });
  async function client() {
    const row = await prisma.client.create({ data: { name: 'Synthetic FCM fixture', email: `fcm-${randomUUID()}@example.test`, isActive: true } });
    ids.push(row.id);
    return row.id;
  }
  it('transfers a shared device and preserves unrelated devices; scoped logout removes only that token', async () => {
    const a = await client(); const b = await client();
    const token = randomUUID(); const other = randomUUID();
    await register.execute({ clientId: a, token, platform: 'ios' });
    await register.execute({ clientId: a, token: other, platform: 'android' });
    await register.execute({ clientId: b, token, platform: 'ios' });
    expect(await prisma.fcmToken.findMany({ where: { token }, select: { clientId: true } })).toEqual([{ clientId: b }]);
    await unregister.execute({ clientId: a, token });
    expect(await prisma.fcmToken.count({ where: { clientId: a, token: other } })).toBe(1);
    expect(await prisma.fcmToken.count({ where: { clientId: b, token } })).toBe(1);
    await unregister.execute({ clientId: b, token });
    expect(await prisma.fcmToken.count({ where: { token } })).toBe(0);
  });
  it('cannot leave a registered device on a closed account when requests overlap', async () => {
    const id = await client(); const token = randomUUID();
    const results = await Promise.allSettled([
      register.execute({ clientId: id, token, platform: 'ios' }),
      close.execute({ clientId: id }),
    ]);
    expect(results[1].status).toBe('fulfilled');
    expect(await prisma.fcmToken.count({ where: { clientId: id } })).toBe(0);
    await expect(register.execute({ clientId: id, token, platform: 'ios' })).rejects.toThrow('Client not found');
  });
});
