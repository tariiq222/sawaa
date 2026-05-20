import { INestApplication } from '@nestjs/common';
import { createTestApp, request, MockPrisma, createAuthToken } from '../../helpers/create-test-app';
import { JwtService } from '@nestjs/jwt';

describe('Booking DeliveryType (e2e)', () => {
  let app: INestApplication;
  let prisma: MockPrisma;
  let jwtService: JwtService;
  let authToken: string;

  beforeAll(async () => {
    const { app: a, prisma: p } = await createTestApp();
    app = a;
    prisma = p;
    jwtService = app.get(JwtService);
    authToken = createAuthToken(jwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/dashboard/bookings', () => {
    it('creates booking with deliveryType=ONLINE', async () => {
      const futureDate = new Date(Date.now() + 86400_000).toISOString();

      prisma.booking.create.mockResolvedValue({
        id: 'book-1',
        branchId: 'branch-1',
        clientId: 'client-1',
        employeeId: 'emp-1',
        serviceId: 'svc-1',
        bookingType: 'INDIVIDUAL',
        deliveryType: 'ONLINE',
        status: 'PENDING',
        scheduledAt: futureDate,
        durationMins: 60,
        price: 200,
        currency: 'SAR',
        bookingNumber: 1,
        createdAt: new Date().toISOString(),
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/dashboard/bookings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          branchId: 'branch-1',
          clientId: 'client-1',
          employeeId: 'emp-1',
          serviceId: 'svc-1',
          scheduledAt: futureDate,
          bookingType: 'INDIVIDUAL',
          deliveryType: 'ONLINE',
        })
        .expect(201);

      expect(res.body.deliveryType).toBe('ONLINE');
      expect(res.body.bookingType).toBe('INDIVIDUAL');
      expect(prisma.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deliveryType: 'ONLINE',
            bookingType: 'INDIVIDUAL',
          }),
        }),
      );
    });

    it('creates booking with deliveryType=IN_PERSON', async () => {
      const futureDate = new Date(Date.now() + 86400_000).toISOString();

      prisma.booking.create.mockResolvedValue({
        id: 'book-2',
        branchId: 'branch-1',
        clientId: 'client-1',
        employeeId: 'emp-1',
        serviceId: 'svc-1',
        bookingType: 'INDIVIDUAL',
        deliveryType: 'IN_PERSON',
        status: 'PENDING',
        scheduledAt: futureDate,
        durationMins: 60,
        price: 200,
        currency: 'SAR',
        bookingNumber: 2,
        createdAt: new Date().toISOString(),
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/dashboard/bookings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          branchId: 'branch-1',
          clientId: 'client-1',
          employeeId: 'emp-1',
          serviceId: 'svc-1',
          scheduledAt: futureDate,
          deliveryType: 'IN_PERSON',
        })
        .expect(201);

      expect(res.body.deliveryType).toBe('IN_PERSON');
    });

    it('maps legacy bookingType=ONLINE to INDIVIDUAL + ONLINE', async () => {
      const futureDate = new Date(Date.now() + 86400_000).toISOString();

      prisma.booking.create.mockResolvedValue({
        id: 'book-3',
        branchId: 'branch-1',
        clientId: 'client-1',
        employeeId: 'emp-1',
        serviceId: 'svc-1',
        bookingType: 'INDIVIDUAL',
        deliveryType: 'ONLINE',
        status: 'PENDING',
        scheduledAt: futureDate,
        durationMins: 60,
        price: 200,
        currency: 'SAR',
        bookingNumber: 3,
        createdAt: new Date().toISOString(),
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/dashboard/bookings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          branchId: 'branch-1',
          clientId: 'client-1',
          employeeId: 'emp-1',
          serviceId: 'svc-1',
          scheduledAt: futureDate,
          bookingType: 'ONLINE',
        })
        .expect(201);

      expect(res.body.bookingType).toBe('INDIVIDUAL');
      expect(res.body.deliveryType).toBe('ONLINE');
      expect(prisma.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            bookingType: 'INDIVIDUAL',
            deliveryType: 'ONLINE',
          }),
        }),
      );
    });

    it('persists snapshot fields on booking creation', async () => {
      const futureDate = new Date(Date.now() + 86400_000).toISOString();

      prisma.branch.findFirst.mockResolvedValue({ id: 'branch-1', nameAr: 'الفرع الرئيسي' });
      prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1', nameAr: 'د. سارة' });
      prisma.service.findFirst.mockResolvedValue({
        id: 'svc-1',
        nameAr: 'استشارة',
        category: { nameAr: 'الاستشارات', department: { nameAr: 'الأقسام الطبية' } },
      });
      prisma.employeeService.findUnique.mockResolvedValue({ id: 'es-1' });
      prisma.booking.create.mockResolvedValue({
        id: 'book-4',
        branchId: 'branch-1',
        clientId: 'client-1',
        employeeId: 'emp-1',
        serviceId: 'svc-1',
        bookingType: 'INDIVIDUAL',
        deliveryType: 'IN_PERSON',
        status: 'PENDING',
        scheduledAt: futureDate,
        durationMins: 60,
        price: 200,
        currency: 'SAR',
        bookingNumber: 4,
        createdAt: new Date().toISOString(),
      });

      await request(app.getHttpServer())
        .post('/api/v1/dashboard/bookings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          branchId: 'branch-1',
          clientId: 'client-1',
          employeeId: 'emp-1',
          serviceId: 'svc-1',
          scheduledAt: futureDate,
        })
        .expect(201);

      expect(prisma.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            priceSnapshot: expect.any(Number),
            durationMinutesSnapshot: expect.any(Number),
            branchNameSnapshot: expect.any(String),
            employeeNameSnapshot: expect.any(String),
            serviceNameSnapshot: expect.any(String),
          }),
        }),
      );
    });
  });

  describe('GET /api/v1/dashboard/bookings/availability', () => {
    it('returns available slots filtered by deliveryType', async () => {
      const tomorrow = new Date(Date.now() + 86400_000);
      tomorrow.setHours(0, 0, 0, 0);

      prisma.businessHour.findUnique.mockResolvedValue({
        branchId: 'branch-1',
        dayOfWeek: tomorrow.getDay(),
        startTime: '09:00',
        endTime: '17:00',
        isOpen: true,
      });
      prisma.employeeAvailability.findMany.mockResolvedValue([
        {
          employeeId: 'emp-1',
          dayOfWeek: tomorrow.getDay(),
          startTime: '09:00',
          endTime: '17:00',
          isActive: true,
        },
      ]);
      prisma.employeeBranch.findUnique.mockResolvedValue({ id: 'eb-1' });
      prisma.employeeBreak.findMany.mockResolvedValue([]);
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.serviceDurationOption.findFirst.mockResolvedValue({ durationMins: 60 });

      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/bookings/availability')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          employeeId: 'emp-1',
          branchId: 'branch-1',
          date: tomorrow.toISOString(),
          serviceId: 'svc-1',
          deliveryType: 'ONLINE',
        })
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(prisma.serviceDurationOption.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            serviceId: 'svc-1',
            deliveryType: 'ONLINE',
            isDefault: true,
            isActive: true,
          }),
        }),
      );
    });

    it('returns empty array when deliveryType is not supported by service', async () => {
      const tomorrow = new Date(Date.now() + 86400_000);
      tomorrow.setHours(0, 0, 0, 0);

      prisma.businessHour.findUnique.mockResolvedValue({
        branchId: 'branch-1',
        dayOfWeek: tomorrow.getDay(),
        startTime: '09:00',
        endTime: '17:00',
        isOpen: true,
      });
      prisma.employeeAvailability.findMany.mockResolvedValue([
        {
          employeeId: 'emp-1',
          dayOfWeek: tomorrow.getDay(),
          startTime: '09:00',
          endTime: '17:00',
          isActive: true,
        },
      ]);
      prisma.employeeBranch.findUnique.mockResolvedValue({ id: 'eb-1' });
      prisma.employeeBreak.findMany.mockResolvedValue([]);
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.serviceDurationOption.findFirst.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/bookings/availability')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          employeeId: 'emp-1',
          branchId: 'branch-1',
          date: tomorrow.toISOString(),
          serviceId: 'svc-1',
          deliveryType: 'ONLINE',
        })
        .expect(200);

      expect(res.body).toEqual([]);
    });
  });
});
