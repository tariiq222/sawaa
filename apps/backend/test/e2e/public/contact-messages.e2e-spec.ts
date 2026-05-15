import { INestApplication } from '@nestjs/common';
import { createTestApp, request, MockPrisma } from '../../helpers/create-test-app';

describe('Public Contact Messages (e2e)', () => {
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

  it('POST /api/v1/public/contact-messages creates a contact message', async () => {
    prisma.contactMessage.create.mockResolvedValue({
      id: 'cm-1',
      name: 'Ali',
      email: 'ali@example.com',
      message: 'Hello',
      status: 'NEW',
    });

    const res = await request(app.getHttpServer())
      .post('/api/v1/public/contact-messages')
      .send({ name: 'Ali', email: 'ali@example.com', message: 'Hello' })
      .expect(201);

    expect(res.body.id).toBe('cm-1');
    expect(prisma.contactMessage.create).toHaveBeenCalled();
  });

  it('POST /api/v1/public/contact-messages validates required fields', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/public/contact-messages')
      .send({ name: 'Ali' })
      .expect(400);
  });
});
