import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { MobileClientNotificationsController } from './notifications.controller';
import { ListNotificationsHandler } from '../../../modules/comms/notifications/list-notifications.handler';
import { MarkReadHandler } from '../../../modules/comms/notifications/mark-read.handler';
import { GetUnreadCountHandler } from '../../../modules/comms/notifications/get-unread-count.handler';
import { RegisterFcmTokenHandler } from '../../../modules/comms/fcm-tokens/register-fcm-token.handler';
import { UnregisterFcmTokenHandler } from '../../../modules/comms/fcm-tokens/unregister-fcm-token.handler';
import { ClientSessionGuard } from '../../../common/guards/client-session.guard';

describe('MobileClientNotificationsController (e2e)', () => {
  let app: INestApplication;

  const mockList = { execute: jest.fn() };
  const mockMarkRead = { execute: jest.fn() };
  const mockUnreadCount = { execute: jest.fn() };
  const mockRegisterFcm = { execute: jest.fn() };
  const mockUnregisterFcm = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [MobileClientNotificationsController],
      providers: [
        { provide: ListNotificationsHandler, useValue: mockList },
        { provide: MarkReadHandler, useValue: mockMarkRead },
        { provide: GetUnreadCountHandler, useValue: mockUnreadCount },
        { provide: RegisterFcmTokenHandler, useValue: mockRegisterFcm },
        { provide: UnregisterFcmTokenHandler, useValue: mockUnregisterFcm },
      ],
    })
      .overrideGuard(ClientSessionGuard)
      .useValue({
        canActivate: (ctx: any) => {
          const req = ctx.switchToHttp().getRequest();
          req.user = { id: 'client-1', organizationId: 'org-1' };
          return true;
        },
      })
      .compile();

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

  describe('GET /mobile/client/notifications', () => {
    it('returns 200 with notification list', async () => {
      mockList.execute.mockResolvedValue({ data: [{ id: 'n-1' }], total: 1, page: 1, limit: 20 });

      const res = await request(app.getHttpServer())
        .get('/mobile/client/notifications')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(mockList.execute).toHaveBeenCalledWith(
        expect.objectContaining({ recipientId: 'client-1', page: 1, limit: 20 }),
      );
    });

    it('passes query filters', async () => {
      mockList.execute.mockResolvedValue({ data: [], total: 0, page: 1, limit: 10 });

      await request(app.getHttpServer())
        .get('/mobile/client/notifications?unreadOnly=true&page=1&limit=10')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(mockList.execute).toHaveBeenCalledWith(
        expect.objectContaining({ recipientId: 'client-1', unreadOnly: true, page: 1, limit: 10 }),
      );
    });
  });

  describe('GET /mobile/client/notifications/unread-count', () => {
    it('returns 200 with unread count', async () => {
      mockUnreadCount.execute.mockResolvedValue({ count: 5 });

      const res = await request(app.getHttpServer())
        .get('/mobile/client/notifications/unread-count')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.count).toBe(5);
    });
  });

  describe('PATCH /mobile/client/notifications/mark-read', () => {
    it('returns 204 on mark all read', async () => {
      mockMarkRead.execute.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .patch('/mobile/client/notifications/mark-read')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(204);

      expect(mockMarkRead.execute).toHaveBeenCalledWith(
        expect.objectContaining({ recipientId: 'client-1' }),
      );
    });

    it('returns 204 on mark single read', async () => {
      mockMarkRead.execute.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .patch('/mobile/client/notifications/mark-read')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ notificationId: '00000000-0000-4000-a000-000000000001' })
        .expect(204);

      expect(mockMarkRead.execute).toHaveBeenCalledWith(
        expect.objectContaining({ recipientId: 'client-1', notificationId: '00000000-0000-4000-a000-000000000001' }),
      );
    });

    it('returns 400 for invalid notificationId', async () => {
      return request(app.getHttpServer())
        .patch('/mobile/client/notifications/mark-read')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ notificationId: 'not-a-uuid' })
        .expect(400);
    });
  });

  describe('POST /mobile/client/notifications/fcm-token', () => {
    it('returns 201 on register', async () => {
      mockRegisterFcm.execute.mockResolvedValue({ id: 'token-1' });

      const res = await request(app.getHttpServer())
        .post('/mobile/client/notifications/fcm-token')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ token: 'fcm-token-123', platform: 'ios' })
        .expect(201);

      expect(mockRegisterFcm.execute).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 'client-1', token: 'fcm-token-123', platform: 'ios' }),
      );
    });

    it('returns 400 for missing token', async () => {
      return request(app.getHttpServer())
        .post('/mobile/client/notifications/fcm-token')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ platform: 'ios' })
        .expect(400);
    });

    it('returns 400 for invalid platform', async () => {
      return request(app.getHttpServer())
        .post('/mobile/client/notifications/fcm-token')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ token: 'abc', platform: 'windows' })
        .expect(400);
    });
  });

  describe('DELETE /mobile/client/notifications/fcm-token', () => {
    it('returns 204 on unregister', async () => {
      mockUnregisterFcm.execute.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete('/mobile/client/notifications/fcm-token')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(204);

      expect(mockUnregisterFcm.execute).toHaveBeenCalledWith({ clientId: 'client-1' });
    });
  });
});
