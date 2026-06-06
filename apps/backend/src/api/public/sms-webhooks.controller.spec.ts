import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PublicSmsWebhooksController } from './sms-webhooks.controller';
import { SmsDlrHandler } from '../../modules/comms/sms-dlr/sms-dlr.handler';

describe('PublicSmsWebhooksController (e2e)', () => {
  let app: INestApplication;

  const mockDlr = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PublicSmsWebhooksController],
      providers: [
        { provide: SmsDlrHandler, useValue: mockDlr },
      ],
    }).compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /public/sms/webhooks/:provider', () => {
    it('returns 200 for UNIFONIC using the default organization internally', async () => {
      mockDlr.execute.mockResolvedValue({ received: true });

      const res = await request(app.getHttpServer())
        .post('/public/sms/webhooks/UNIFONIC')
        .set('X-Signature', 'valid-sig')
        .send({ id: 'msg-1', status: 'delivered' })
        .expect(200);

      expect(res.body.received).toBe(true);
      expect(mockDlr.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'UNIFONIC',
          organizationId: '00000000-0000-0000-0000-000000000001',
          rawBody: expect.any(String),
          signature: 'valid-sig',
        }),
      );
    });

    it('returns 400 for unsupported provider', async () => {
      const res = await request(app.getHttpServer())
        .post('/public/sms/webhooks/TWILIO')
        .set('X-Signature', 'sig')
        .send({ id: 'msg-1' })
        .expect(400);

      expect(res.body.message).toBe('Unsupported SMS provider: TWILIO');
    });

    it('returns 400 for missing signature header', async () => {
      const res = await request(app.getHttpServer())
        .post('/public/sms/webhooks/UNIFONIC')
        .send({ id: 'msg-1' })
        .expect(400);

      expect(res.body.message).toBe('Missing X-Signature header');
    });

    it('returns 400 for missing body', async () => {
      const res = await request(app.getHttpServer())
        .post('/public/sms/webhooks/UNIFONIC')
        .set('X-Signature', 'sig')
        .set('Content-Type', 'application/json')
        .send('')
        .expect(400);

      expect(res.body.message).toBe('Missing request body');
    });
  });

  describe('POST /public/sms/webhooks/:provider/:organizationId (legacy)', () => {
    it('returns 200 for UNIFONIC when organizationId is DEFAULT_ORG_ID', async () => {
      mockDlr.execute.mockResolvedValue({ received: true });

      const res = await request(app.getHttpServer())
        .post('/public/sms/webhooks/UNIFONIC/00000000-0000-0000-0000-000000000001')
        .set('X-Signature', 'valid-sig')
        .send({ id: 'msg-1', status: 'delivered' })
        .expect(200);

      expect(res.body.received).toBe(true);
      expect(mockDlr.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'UNIFONIC',
          organizationId: '00000000-0000-0000-0000-000000000001',
          rawBody: expect.any(String),
          signature: 'valid-sig',
        }),
      );
    });

    it('returns 200 for TAQNYAT', async () => {
      mockDlr.execute.mockResolvedValue({ received: true });

      const res = await request(app.getHttpServer())
        .post('/public/sms/webhooks/TAQNYAT/00000000-0000-0000-0000-000000000001')
        .set('X-Signature', 'valid-sig')
        .send({ id: 'msg-1', status: 'delivered' })
        .expect(200);

      expect(res.body.received).toBe(true);
      expect(mockDlr.execute).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'TAQNYAT' }),
      );
    });

    it('returns 400 for unsupported provider when legacy organizationId is valid', async () => {
      const res = await request(app.getHttpServer())
        .post('/public/sms/webhooks/TWILIO/00000000-0000-0000-0000-000000000001')
        .set('X-Signature', 'sig')
        .send({ id: 'msg-1' })
        .expect(400);

      expect(res.body.message).toBe('Unsupported SMS provider: TWILIO');
    });

    it('returns 400 for wrong organizationId', async () => {
      const res = await request(app.getHttpServer())
        .post('/public/sms/webhooks/UNIFONIC/00000000-0000-4000-a000-000000000002')
        .set('X-Signature', 'sig')
        .send({ id: 'msg-1' })
        .expect(400);

      expect(res.body.message).toContain('Unknown organization');
    });

    it('returns 400 for missing signature header', async () => {
      const res = await request(app.getHttpServer())
        .post('/public/sms/webhooks/UNIFONIC/00000000-0000-0000-0000-000000000001')
        .send({ id: 'msg-1' })
        .expect(400);

      expect(res.body.message).toBe('Missing X-Signature header');
    });

    it('returns 400 for missing body', async () => {
      // Need to send empty body but with content-type to trigger body parsing
      const res = await request(app.getHttpServer())
        .post('/public/sms/webhooks/UNIFONIC/00000000-0000-0000-0000-000000000001')
        .set('X-Signature', 'sig')
        .set('Content-Type', 'application/json')
        .send('')
        .expect(400);

      expect(res.body.message).toBe('Missing request body');
    });
  });
});
