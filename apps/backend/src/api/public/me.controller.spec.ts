import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PublicMeController } from './me.controller';
import { GetMeHandler } from '../../modules/identity/client-auth/get-me.handler';
import { UpdateClientProfileHandler } from '../../modules/identity/client-auth/update-client-profile.handler';
import { ListClientInvoicesHandler } from '../../modules/finance/list-client-invoices/list-client-invoices.handler';
import { ListClientBookingsHandler } from '../../modules/bookings/client/list-client-bookings.handler';
import { ClientCancelBookingHandler } from '../../modules/bookings/client/client-cancel-booking.handler';
import { ClientRescheduleBookingHandler } from '../../modules/bookings/client/client-reschedule-booking.handler';
import { GetClientBookingHandler } from '../../modules/bookings/client/get-client-booking.handler';
import { GetBookingInvoiceHandler } from '../../modules/finance/get-invoice/get-booking-invoice.handler';
import { ClientSessionGuard } from '../../common/guards/client-session.guard';

describe('PublicMeController (e2e)', () => {
  let app: INestApplication;

  const mockGetMe = { execute: jest.fn() };
  const mockUpdateProfile = { execute: jest.fn() };
  const mockListInvoices = { execute: jest.fn() };
  const mockListBookings = { execute: jest.fn() };
  const mockCancel = { execute: jest.fn() };
  const mockReschedule = { execute: jest.fn() };
  const mockGetClientBooking = { execute: jest.fn() };
  const mockGetInvoice = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PublicMeController],
      providers: [
        { provide: GetMeHandler, useValue: mockGetMe },
        { provide: UpdateClientProfileHandler, useValue: mockUpdateProfile },
        { provide: ListClientInvoicesHandler, useValue: mockListInvoices },
        { provide: ListClientBookingsHandler, useValue: mockListBookings },
        { provide: ClientCancelBookingHandler, useValue: mockCancel },
        { provide: ClientRescheduleBookingHandler, useValue: mockReschedule },
        { provide: GetClientBookingHandler, useValue: mockGetClientBooking },
        { provide: GetBookingInvoiceHandler, useValue: mockGetInvoice },
      ],
    })
      .overrideGuard(ClientSessionGuard)
      .useValue({
        canActivate: (ctx: any) => {
          ctx.switchToHttp().getRequest().user = { id: 'client-1', organizationId: 'org-1' };
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

  describe('GET /public/me', () => {
    it('returns 200 with client profile', async () => {
      mockGetMe.execute.mockResolvedValue({ id: 'client-1', name: 'Sara', phone: '+966501234567' });

      const res = await request(app.getHttpServer())
        .get('/public/me')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.name).toBe('Sara');
      expect(mockGetMe.execute).toHaveBeenCalledWith('client-1');
    });
  });

  describe('PATCH /public/me', () => {
    it('returns 200 with updated profile', async () => {
      mockUpdateProfile.execute.mockResolvedValue({ id: 'client-1', name: 'Sara Ali', phone: '+966501234567' });

      const res = await request(app.getHttpServer())
        .patch('/public/me')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ name: 'Sara Ali' })
        .expect(200);

      expect(res.body.name).toBe('Sara Ali');
      expect(mockUpdateProfile.execute).toHaveBeenCalledWith('client-1', { name: 'Sara Ali' });
    });

    it('normalizes a local phone number to E.164 before the handler', async () => {
      mockUpdateProfile.execute.mockResolvedValue({ id: 'client-1', phone: '+966501234567' });

      await request(app.getHttpServer())
        .patch('/public/me')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ phone: '0501234567' })
        .expect(200);

      expect(mockUpdateProfile.execute).toHaveBeenCalledWith('client-1', { phone: '+966501234567' });
    });

    it('returns 400 for a non-Saudi phone number', async () => {
      return request(app.getHttpServer())
        .patch('/public/me')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ phone: '+12025550123' })
        .expect(400);
    });

    it('returns 400 for a too-short name', async () => {
      return request(app.getHttpServer())
        .patch('/public/me')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ name: 'a' })
        .expect(400);
    });

    it('returns 400 for unknown fields', async () => {
      return request(app.getHttpServer())
        .patch('/public/me')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ unknownField: 'x' })
        .expect(400);
    });
  });

  describe('GET /public/me/invoices', () => {
    it('returns 200 with paginated invoices using defaults', async () => {
      mockListInvoices.execute.mockResolvedValue({
        items: [{ id: 'inv-1', total: 17250 }],
        total: 1,
        page: 1,
        pageSize: 20,
      });

      const res = await request(app.getHttpServer())
        .get('/public/me/invoices')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(mockListInvoices.execute).toHaveBeenCalledWith('client-1', 1, 20);
    });

    it('passes page and pageSize query params', async () => {
      mockListInvoices.execute.mockResolvedValue({ items: [], total: 0, page: 2, pageSize: 5 });

      await request(app.getHttpServer())
        .get('/public/me/invoices?page=2&pageSize=5')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(mockListInvoices.execute).toHaveBeenCalledWith('client-1', 2, 5);
    });
  });

  describe('GET /public/me/bookings', () => {
    it('returns 200 with paginated bookings', async () => {
      mockListBookings.execute.mockResolvedValue({
        data: [{ id: 'b-1', status: 'CONFIRMED' }],
        total: 1,
        page: 1,
        pageSize: 10,
      });

      const res = await request(app.getHttpServer())
        .get('/public/me/bookings')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(mockListBookings.execute).toHaveBeenCalledWith('client-1', 1, 10);
    });

    it('passes page and pageSize query params', async () => {
      mockListBookings.execute.mockResolvedValue({ data: [], total: 0, page: 2, pageSize: 5 });

      await request(app.getHttpServer())
        .get('/public/me/bookings?page=2&pageSize=5')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(mockListBookings.execute).toHaveBeenCalledWith('client-1', 2, 5);
    });
  });

  describe('PATCH /public/me/bookings/:id/cancel', () => {
    it('returns 200 on cancel with reason', async () => {
      mockCancel.execute.mockResolvedValue({ id: 'b-1', status: 'CANCELLED' });

      const res = await request(app.getHttpServer())
        .patch('/public/me/bookings/00000000-0000-4000-a000-000000000001/cancel')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ reason: 'changed my mind' })
        .expect(200);

      expect(res.body.status).toBe('CANCELLED');
      expect(mockCancel.execute).toHaveBeenCalledWith({
        bookingId: '00000000-0000-4000-a000-000000000001',
        clientId: 'client-1',
        reason: 'changed my mind',
      });
    });

    it('returns 200 on cancel without reason', async () => {
      mockCancel.execute.mockResolvedValue({ id: 'b-1', status: 'CANCELLED' });

      const res = await request(app.getHttpServer())
        .patch('/public/me/bookings/00000000-0000-4000-a000-000000000001/cancel')
        .set('Authorization', 'Bearer fake-jwt')
        .send({})
        .expect(200);

      expect(res.body.status).toBe('CANCELLED');
    });

    it('returns 400 for invalid UUID', async () => {
      return request(app.getHttpServer())
        .patch('/public/me/bookings/not-a-uuid/cancel')
        .set('Authorization', 'Bearer fake-jwt')
        .send({})
        .expect(400);
    });
  });

  describe('GET /public/me/bookings/:id/invoice', () => {
    it('returns 200 with invoice', async () => {
      mockGetInvoice.execute.mockResolvedValue({ id: 'inv-1', total: 150 });

      const res = await request(app.getHttpServer())
        .get('/public/me/bookings/00000000-0000-4000-a000-000000000001/invoice')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.total).toBe(150);
      expect(mockGetInvoice.execute).toHaveBeenCalledWith(
        '00000000-0000-4000-a000-000000000001',
        'client-1',
      );
    });
  });

  describe('PATCH /public/me/bookings/:id/reschedule', () => {
    it('returns 200 on reschedule', async () => {
      mockReschedule.execute.mockResolvedValue({ id: 'b-1', status: 'RESCHEDULED' });

      const res = await request(app.getHttpServer())
        .patch('/public/me/bookings/00000000-0000-4000-a000-000000000001/reschedule')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ newScheduledAt: '2026-12-31T10:00:00Z' })
        .expect(200);

      expect(res.body.status).toBe('RESCHEDULED');
      expect(mockReschedule.execute).toHaveBeenCalledWith({
        bookingId: '00000000-0000-4000-a000-000000000001',
        clientId: 'client-1',
        newScheduledAt: '2026-12-31T10:00:00Z',
        newDurationMins: undefined,
      });
    });

    it('returns 200 on reschedule with duration', async () => {
      mockReschedule.execute.mockResolvedValue({ id: 'b-1', status: 'RESCHEDULED' });

      await request(app.getHttpServer())
        .patch('/public/me/bookings/00000000-0000-4000-a000-000000000001/reschedule')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ newScheduledAt: '2026-12-31T10:00:00Z', newDurationMins: 30 })
        .expect(200);

      expect(mockReschedule.execute).toHaveBeenCalledWith({
        bookingId: '00000000-0000-4000-a000-000000000001',
        clientId: 'client-1',
        newScheduledAt: '2026-12-31T10:00:00Z',
        newDurationMins: 30,
      });
    });

    it('returns 400 for missing newScheduledAt', async () => {
      return request(app.getHttpServer())
        .patch('/public/me/bookings/00000000-0000-4000-a000-000000000001/reschedule')
        .set('Authorization', 'Bearer fake-jwt')
        .send({})
        .expect(400);
    });

    it('returns 400 for invalid newDurationMins', async () => {
      return request(app.getHttpServer())
        .patch('/public/me/bookings/00000000-0000-4000-a000-000000000001/reschedule')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ newScheduledAt: '2026-12-31T10:00:00Z', newDurationMins: 5 })
        .expect(400);
    });
  });
});
