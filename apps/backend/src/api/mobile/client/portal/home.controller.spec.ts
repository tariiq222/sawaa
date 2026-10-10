import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { GetClientBookingHandler } from '../../../../modules/bookings/client/get-client-booking.handler';
import { PrismaService } from '../../../../infrastructure/database';
import { formatTimeOfDay } from '../../../../../../mobile/lib/session-format';
import { MobileClientHomeController } from './home.controller';
import { ListClientUpcomingBookingsHandler } from '../../../../modules/bookings/client/list-client-upcoming-bookings.handler';
import { ListBookingsHandler } from '../../../../modules/bookings/list-bookings/list-bookings.handler';
import { ListNotificationsHandler } from '../../../../modules/comms/notifications/list-notifications.handler';
import { ListPaymentsHandler } from '../../../../modules/finance/list-payments/list-payments.handler';
import { GetClientHandler } from '../../../../modules/people/clients/get-client.handler';
import { ClientSessionGuard } from '../../../../common/guards/client-session.guard';

describe('MobileClientHomeController (e2e)', () => {
  let app: INestApplication;

  const mockUpcoming = { execute: jest.fn() };
  const mockListBookings = { execute: jest.fn() };
  const mockListNotifications = { execute: jest.fn() };
  const mockListPayments = { execute: jest.fn() };
  const mockGetClient = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [MobileClientHomeController],
      providers: [
        { provide: ListClientUpcomingBookingsHandler, useValue: mockUpcoming },
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

  beforeEach(() => { mockUpcoming.execute.mockResolvedValue({ data: [{ id: 'b-1' }], meta: { total: 1 } }); });

  describe('GET /mobile/client/portal/home', () => {
    it('returns 200 with aggregated home data', async () => {
      mockListBookings.execute.mockResolvedValue({ items: [{ id: 'b-1' }], meta: { total: 1 } });
      mockListNotifications.execute.mockResolvedValue({ items: [{ id: 'n-1' }], meta: { total: 1 } });
      mockListPayments.execute.mockResolvedValue({ items: [{ id: 'p-1' }], meta: { total: 1 } });
      mockGetClient.execute.mockResolvedValue({ id: 'client-1', name: 'Sara' });

      const res = await request(app.getHttpServer())
        .get('/mobile/client/portal/home')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.profile.name).toBe('Sara');
      expect(res.body.upcomingBookings).toHaveLength(1);
      expect(res.body.unreadNotifications).toHaveLength(1);
      expect(res.body.recentPayments).toHaveLength(1);

      expect(mockUpcoming.execute).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 'client-1', now: expect.any(Date), page: 1, limit: 5 }),
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
    it('uses the authenticated upcoming read instead of generic cancelled or past bookings', async () => {
      mockListBookings.execute.mockResolvedValue({ items: [{ id: 'ended' }, { id: 'cancelled' }], meta: { total: 2 } });
      mockUpcoming.execute.mockResolvedValue({ data: [{ id: 'nearest', scheduledAt: '2026-10-09T13:00:00.000Z', status: 'confirmed' }], meta: { total: 1 } });
      mockListNotifications.execute.mockResolvedValue([]);
      mockListPayments.execute.mockResolvedValue([]);
      mockGetClient.execute.mockResolvedValue({ id: 'client-1' });
      const res = await request(app.getHttpServer()).get('/mobile/client/portal/home').expect(200);
      expect(res.body.upcomingBookings.map((row: { id: string }) => row.id)).toEqual(['nearest']);
    });

  });
});


describe('home/detail timestamp boundary', () => {
  it('serializes one booking to the same canonical instant and Riyadh time through both real read paths', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-09T12:00:00Z'));
    try {
      const booking = { id: 'same-booking', clientId: 'client-1', employeeId: 'employee-1', serviceId: 'service-1', branchId: 'branch-1', scheduledAt: new Date('2026-10-09T13:00:00Z'), endsAt: new Date('2026-10-09T14:00:00Z'), status: 'CONFIRMED', bookingType: 'INDIVIDUAL', deliveryType: 'IN_PERSON', price: 15000, currency: 'SAR', durationMins: 60, createdAt: new Date('2026-10-01T00:00:00Z'), updatedAt: new Date('2026-10-01T00:00:00Z') };
      const prisma = {
        booking: { findMany: jest.fn().mockResolvedValue([booking]), count: jest.fn().mockResolvedValue(1), findFirst: jest.fn().mockResolvedValue(booking) },
        employee: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
        service: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
        client: { findFirst: jest.fn().mockResolvedValue(null) }, branch: { findFirst: jest.fn().mockResolvedValue(null) }, invoice: { findFirst: jest.fn().mockResolvedValue(null) },
      } as unknown as PrismaService;
      const home = new MobileClientHomeController(new ListClientUpcomingBookingsHandler(prisma), { execute: async () => [] } as unknown as ListNotificationsHandler, { execute: async () => [] } as unknown as ListPaymentsHandler, { execute: async () => null } as unknown as GetClientHandler);
      const detail = new GetClientBookingHandler(prisma, { execute: jest.fn() } as never);
      const homeJson = JSON.parse(JSON.stringify(await home.home({ id: 'client-1' } as Parameters<typeof home.home>[0])));
      const detailJson = JSON.parse(JSON.stringify(await detail.execute('same-booking', 'client-1')));
      expect(homeJson.upcomingBookings[0]).toMatchObject({ scheduledAt: '2026-10-09T13:00:00.000Z', date: '2026-10-09', startTime: '16:00' });
      expect(detailJson.scheduledAt).toBe('2026-10-09T13:00:00.000Z');
      expect(formatTimeOfDay(homeJson.upcomingBookings[0].scheduledAt, false)).toBe('4:00 PM');
      expect(formatTimeOfDay(detailJson.scheduledAt, false)).toBe('4:00 PM');
    } finally { jest.useRealTimers(); }
  });
});
