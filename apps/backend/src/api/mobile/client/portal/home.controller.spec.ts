import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MobileClientHomeController } from './home.controller';
import { ListBookingsHandler } from '../../../../modules/bookings/list-bookings/list-bookings.handler';
import { ListNotificationsHandler } from '../../../../modules/comms/notifications/list-notifications.handler';
import { ListPaymentsHandler } from '../../../../modules/finance/list-payments/list-payments.handler';
import { GetClientHandler } from '../../../../modules/people/clients/get-client.handler';
import { ClientSessionGuard } from '../../../../common/guards/client-session.guard';

describe('MobileClientHomeController (e2e)', () => {
  let app: INestApplication;

  const mockListBookings = { execute: jest.fn() };
  const mockListNotifications = { execute: jest.fn() };
  const mockListPayments = { execute: jest.fn() };
  const mockGetClient = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [MobileClientHomeController],
      providers: [
        { provide: ListBookingsHandler, useValue: mockListBookings },
        { provide: ListNotificationsHandler, useValue: mockListNotifications },
        { provide: ListPaymentsHandler, useValue: mockListPayments },
        { provide: GetClientHandler, useValue: mockGetClient },
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
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /mobile/client/portal/home', () => {
    it('returns 200 with aggregated home data', async () => {
      mockListBookings.execute.mockResolvedValue({ data: [{ id: 'b-1' }], total: 1 });
      mockListNotifications.execute.mockResolvedValue({ data: [{ id: 'n-1' }], total: 1 });
      mockListPayments.execute.mockResolvedValue({ data: [{ id: 'p-1' }], total: 1 });
      mockGetClient.execute.mockResolvedValue({ id: 'client-1', name: 'Sara' });

      const res = await request(app.getHttpServer())
        .get('/mobile/client/portal/home')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.profile.name).toBe('Sara');
      expect(res.body.upcomingBookings).toHaveLength(1);
      expect(res.body.unreadNotifications).toHaveLength(1);
      expect(res.body.recentPayments).toHaveLength(1);

      expect(mockListBookings.execute).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 'client-1', fromDate: expect.any(Date), page: 1, limit: 5 }),
      );
      expect(mockListNotifications.execute).toHaveBeenCalledWith(
        expect.objectContaining({ recipientId: 'client-1', unreadOnly: true, page: 1, limit: 5 }),
      );
      expect(mockListPayments.execute).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 'client-1', page: 1, limit: 3 }),
      );
    });

    it('handles array results directly', async () => {
      mockListBookings.execute.mockResolvedValue([{ id: 'b-1' }]);
      mockListNotifications.execute.mockResolvedValue([{ id: 'n-1' }]);
      mockListPayments.execute.mockResolvedValue([{ id: 'p-1' }]);
      mockGetClient.execute.mockResolvedValue({ id: 'client-1' });

      const res = await request(app.getHttpServer())
        .get('/mobile/client/portal/home')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.upcomingBookings).toHaveLength(1);
      expect(res.body.unreadNotifications).toHaveLength(1);
      expect(res.body.recentPayments).toHaveLength(1);
    });
  });
});
