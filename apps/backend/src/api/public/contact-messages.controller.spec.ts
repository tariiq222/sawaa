import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PublicContactMessagesController } from './contact-messages.controller';
import { CreateContactMessageHandler } from '../../modules/comms/contact-messages/create-contact-message.handler';

describe('PublicContactMessagesController (e2e)', () => {
  let app: INestApplication;

  const mockCreate = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PublicContactMessagesController],
      providers: [
        { provide: CreateContactMessageHandler, useValue: mockCreate },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /public/contact-messages', () => {
    it('returns 201 on valid submission', async () => {
      mockCreate.execute.mockResolvedValue({ id: 'msg-1', status: 'NEW' });

      const res = await request(app.getHttpServer())
        .post('/public/contact-messages')
        .send({
          name: 'سارة أحمد',
          phone: '+966501234567',
          email: 'sara@example.com',
          subject: 'استفسار',
          body: 'أرغب بمعرفة مواعيد العمل',
        })
        .expect(201);

      expect(res.body.id).toBe('msg-1');
      expect(mockCreate.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'سارة أحمد',
          body: 'أرغب بمعرفة مواعيد العمل',
        }),
      );
    });

    it('returns 400 for missing name', async () => {
      return request(app.getHttpServer())
        .post('/public/contact-messages')
        .send({ body: 'message body' })
        .expect(400);
    });

    it('returns 400 for short body', async () => {
      return request(app.getHttpServer())
        .post('/public/contact-messages')
        .send({ name: 'Test', body: 'hi' })
        .expect(400);
    });

    it('returns 400 for invalid email', async () => {
      return request(app.getHttpServer())
        .post('/public/contact-messages')
        .send({ name: 'Test', email: 'not-an-email', body: 'valid message body here' })
        .expect(400);
    });

    it('returns 400 for invalid phone', async () => {
      return request(app.getHttpServer())
        .post('/public/contact-messages')
        .send({ name: 'Test', phone: 'abc', body: 'valid message body here' })
        .expect(400);
    });

    it('returns 400 for unknown fields', async () => {
      return request(app.getHttpServer())
        .post('/public/contact-messages')
        .send({ name: 'Test', body: 'valid message body here', extra: 'bad' })
        .expect(400);
    });
  });
});
