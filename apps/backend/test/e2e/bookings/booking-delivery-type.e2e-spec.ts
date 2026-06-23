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

  const BRANCH_ID = 'e4ce5937-1ba1-4f22-9ad1-c62d10961dde';
  const CLIENT_ID = 'ae461556-3b09-4fa2-a9f6-1b2f156298bf';
  const EMPLOYEE_ID = '65b0c5c9-e700-4e3f-ab13-a6f42d68b4d1';
  const SERVICE_ID = '6b5c1a2e-23d9-4328-88a6-b4a41b9ee524';

  // CheckAvailabilityHandler builds slot grid at 30-min boundaries starting from
  // window start (00:00 in the mocked all-day shift). `assertSlotAvailable` only
  // accepts an exact match, so the e2e payload must pick a boundary timestamp
  // tomorrow. Returns ISO at tomorrow 10:00 local server time.
  const tomorrowAtTenISO = () => {
    const d = new Date(Date.now() + 86400_000);
    d.setHours(10, 0, 0, 0);
    return d.toISOString();
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.branch.findFirst.mockResolvedValue({ id: BRANCH_ID, nameAr: 'الفرع', nameEn: 'Branch', isActive: true });
    prisma.client.findFirst.mockResolvedValue({ id: CLIENT_ID, isActive: true });
    prisma.employee.findFirst.mockResolvedValue({ id: EMPLOYEE_ID, name: 'موظف', nameAr: 'موظف', isActive: true });
    const serviceRow = {
      id: SERVICE_ID,
      nameAr: 'خدمة',
      price: 20000,
      duration: 60,
      durationMins: 60,
      currency: 'SAR',
      isActive: true,
      category: { nameAr: 'تصنيف', department: { nameAr: 'قسم' } },
    };
    prisma.service.findFirst.mockResolvedValue(serviceRow);
    prisma.service.findUniqueOrThrow.mockResolvedValue(serviceRow);
    prisma.service.findUnique.mockResolvedValue(serviceRow);
    prisma.employeeService.findUnique.mockResolvedValue({
      id: 'employee-service-1',
      isActive: true,
      availableTypes: ['IN_PERSON', 'ONLINE'],
    });
    prisma.serviceBookingConfig.findMany.mockResolvedValue([
      { deliveryType: 'IN_PERSON', isActive: true },
      { deliveryType: 'ONLINE', isActive: true },
    ]);
    prisma.bookingSettings.findFirst.mockResolvedValue(null);
    prisma.organizationSettings.findFirst.mockResolvedValue({
      defaultCurrency: 'SAR',
      bookingNumberPrefix: 'BK',
    });
    prisma.serviceCategory.findFirst.mockResolvedValue({ id: 'cat-1', nameAr: 'تصنيف' });
    prisma.department.findFirst.mockResolvedValue({ id: 'dep-1', nameAr: 'قسم' });

    // The custom-availability feature wires CheckAvailabilityHandler into the
    // create-booking path, so e2e tests that previously stubbed only the write
    // models now also need the availability surface (business hour, employee
    // shift, branch link, no breaks/holidays/conflicts) to expose a slot at
    // the scheduledAt timestamp the test sends.
    const allHours = (day: number) => ({
      branchId: BRANCH_ID,
      dayOfWeek: day,
      startTime: '00:00',
      endTime: '23:59',
      isOpen: true,
    });
    prisma.businessHour.findUnique.mockImplementation(({ where }: any) =>
      Promise.resolve(allHours(where?.branchId_dayOfWeek?.dayOfWeek ?? 0)),
    );
    prisma.employeeAvailability.findMany.mockResolvedValue(
      Array.from({ length: 7 }, (_, day) => ({
        employeeId: EMPLOYEE_ID,
        dayOfWeek: day,
        startTime: '00:00',
        endTime: '23:59',
        isActive: true,
      })),
    );
    prisma.employeeBranch.findUnique.mockResolvedValue({ id: 'eb-1' });
    prisma.employeeBreak.findMany.mockResolvedValue([]);
    prisma.employeeAvailabilityException.findMany.mockResolvedValue([]);
    prisma.holiday.findFirst.mockResolvedValue(null);
    prisma.booking.findMany.mockResolvedValue([]);
    // Default: service supports the requested delivery type. Individual tests
    // override with `mockResolvedValueOnce(null)` to assert "unsupported".
    prisma.serviceBookingConfig.findUnique.mockResolvedValue({ useCustomAvailability: false });
    prisma.serviceAvailabilityWindow.findMany.mockResolvedValue([]);
  });

  describe('POST /api/v1/dashboard/bookings', () => {
    it('creates booking with deliveryType=ONLINE', async () => {
      const futureDate = tomorrowAtTenISO();

      prisma.booking.create.mockResolvedValue({
        id: 'book-1',
        branchId: 'e4ce5937-1ba1-4f22-9ad1-c62d10961dde',
        clientId: 'ae461556-3b09-4fa2-a9f6-1b2f156298bf',
        employeeId: '65b0c5c9-e700-4e3f-ab13-a6f42d68b4d1',
        serviceId: '6b5c1a2e-23d9-4328-88a6-b4a41b9ee524',
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
          branchId: 'e4ce5937-1ba1-4f22-9ad1-c62d10961dde',
          clientId: 'ae461556-3b09-4fa2-a9f6-1b2f156298bf',
          employeeId: '65b0c5c9-e700-4e3f-ab13-a6f42d68b4d1',
          serviceId: '6b5c1a2e-23d9-4328-88a6-b4a41b9ee524',
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
      const futureDate = tomorrowAtTenISO();

      prisma.booking.create.mockResolvedValue({
        id: 'book-2',
        branchId: 'e4ce5937-1ba1-4f22-9ad1-c62d10961dde',
        clientId: 'ae461556-3b09-4fa2-a9f6-1b2f156298bf',
        employeeId: '65b0c5c9-e700-4e3f-ab13-a6f42d68b4d1',
        serviceId: '6b5c1a2e-23d9-4328-88a6-b4a41b9ee524',
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
          branchId: 'e4ce5937-1ba1-4f22-9ad1-c62d10961dde',
          clientId: 'ae461556-3b09-4fa2-a9f6-1b2f156298bf',
          employeeId: '65b0c5c9-e700-4e3f-ab13-a6f42d68b4d1',
          serviceId: '6b5c1a2e-23d9-4328-88a6-b4a41b9ee524',
          scheduledAt: futureDate,
          deliveryType: 'IN_PERSON',
        })
        .expect(201);

      expect(res.body.deliveryType).toBe('IN_PERSON');
    });

    it('maps legacy bookingType=ONLINE to INDIVIDUAL + ONLINE', async () => {
      const futureDate = tomorrowAtTenISO();

      prisma.booking.create.mockResolvedValue({
        id: 'book-3',
        branchId: 'e4ce5937-1ba1-4f22-9ad1-c62d10961dde',
        clientId: 'ae461556-3b09-4fa2-a9f6-1b2f156298bf',
        employeeId: '65b0c5c9-e700-4e3f-ab13-a6f42d68b4d1',
        serviceId: '6b5c1a2e-23d9-4328-88a6-b4a41b9ee524',
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
          branchId: 'e4ce5937-1ba1-4f22-9ad1-c62d10961dde',
          clientId: 'ae461556-3b09-4fa2-a9f6-1b2f156298bf',
          employeeId: '65b0c5c9-e700-4e3f-ab13-a6f42d68b4d1',
          serviceId: '6b5c1a2e-23d9-4328-88a6-b4a41b9ee524',
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
      const futureDate = tomorrowAtTenISO();

      prisma.branch.findFirst.mockResolvedValue({ id: 'e4ce5937-1ba1-4f22-9ad1-c62d10961dde', nameAr: 'الفرع الرئيسي' });
      prisma.employee.findFirst.mockResolvedValue({
        id: '65b0c5c9-e700-4e3f-ab13-a6f42d68b4d1',
        name: 'د. سارة',
        nameAr: 'د. سارة',
        isActive: true,
      });
      const serviceRow2 = {
        id: '6b5c1a2e-23d9-4328-88a6-b4a41b9ee524',
        nameAr: 'استشارة',
        price: 20000,
        durationMins: 60,
        currency: 'SAR',
        isActive: true,
        category: { nameAr: 'الاستشارات', department: { nameAr: 'الأقسام الطبية' } },
      };
      prisma.service.findFirst.mockResolvedValue(serviceRow2);
      prisma.service.findUniqueOrThrow.mockResolvedValue(serviceRow2);
      prisma.service.findUnique.mockResolvedValue(serviceRow2);
      prisma.employeeService.findUnique.mockResolvedValue({
        id: '9652f884-c62e-424d-8cda-d0c0bd792544',
        isActive: true,
        availableTypes: ['IN_PERSON', 'ONLINE'],
      });
      prisma.booking.create.mockResolvedValue({
        id: 'book-4',
        branchId: 'e4ce5937-1ba1-4f22-9ad1-c62d10961dde',
        clientId: 'ae461556-3b09-4fa2-a9f6-1b2f156298bf',
        employeeId: '65b0c5c9-e700-4e3f-ab13-a6f42d68b4d1',
        serviceId: '6b5c1a2e-23d9-4328-88a6-b4a41b9ee524',
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
          branchId: 'e4ce5937-1ba1-4f22-9ad1-c62d10961dde',
          clientId: 'ae461556-3b09-4fa2-a9f6-1b2f156298bf',
          employeeId: '65b0c5c9-e700-4e3f-ab13-a6f42d68b4d1',
          serviceId: '6b5c1a2e-23d9-4328-88a6-b4a41b9ee524',
          scheduledAt: futureDate,
        })
        .expect(201);

      expect(prisma.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            priceSnapshot: expect.anything(),
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
        branchId: 'e4ce5937-1ba1-4f22-9ad1-c62d10961dde',
        dayOfWeek: tomorrow.getDay(),
        startTime: '09:00',
        endTime: '17:00',
        isOpen: true,
      });
      prisma.employeeAvailability.findMany.mockResolvedValue([
        {
          employeeId: '65b0c5c9-e700-4e3f-ab13-a6f42d68b4d1',
          dayOfWeek: tomorrow.getDay(),
          startTime: '09:00',
          endTime: '17:00',
          isActive: true,
        },
      ]);
      prisma.employeeBranch.findUnique.mockResolvedValue({ id: 'd7a2540e-b8f1-4836-aa68-a2c687f02551' });
      prisma.employeeBreak.findMany.mockResolvedValue([]);
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.serviceDurationOption.findFirst.mockResolvedValue({ durationMins: 60 });

      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/bookings/availability')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          employeeId: '65b0c5c9-e700-4e3f-ab13-a6f42d68b4d1',
          branchId: 'e4ce5937-1ba1-4f22-9ad1-c62d10961dde',
          date: tomorrow.toISOString(),
          serviceId: '6b5c1a2e-23d9-4328-88a6-b4a41b9ee524',
          deliveryType: 'ONLINE',
        })
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(prisma.serviceDurationOption.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            serviceId: '6b5c1a2e-23d9-4328-88a6-b4a41b9ee524',
            deliveryType: 'ONLINE',
            isDefault: true,
            isActive: true,
          }),
        }),
      );
    });

    it('rejects unsupported deliveryType with 400', async () => {
      const tomorrow = new Date(Date.now() + 86400_000);
      tomorrow.setHours(0, 0, 0, 0);

      prisma.businessHour.findUnique.mockResolvedValue({
        branchId: 'e4ce5937-1ba1-4f22-9ad1-c62d10961dde',
        dayOfWeek: tomorrow.getDay(),
        startTime: '09:00',
        endTime: '17:00',
        isOpen: true,
      });
      prisma.employeeAvailability.findMany.mockResolvedValue([
        {
          employeeId: '65b0c5c9-e700-4e3f-ab13-a6f42d68b4d1',
          dayOfWeek: tomorrow.getDay(),
          startTime: '09:00',
          endTime: '17:00',
          isActive: true,
        },
      ]);
      prisma.employeeBranch.findUnique.mockResolvedValue({ id: 'd7a2540e-b8f1-4836-aa68-a2c687f02551' });
      prisma.employeeBreak.findMany.mockResolvedValue([]);
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.serviceDurationOption.findFirst.mockResolvedValue(null);
      // Service does not support ONLINE — handler reads serviceBookingConfig
      // by (serviceId, deliveryType); a null row signals "unsupported" and the
      // handler now throws BadRequestException (unless the caller opts into
      // silentOnMissingConfig, which this endpoint does not).
      //
      // Use mockResolvedValue (not ...Once): the handler queries
      // serviceBookingConfig.findUnique twice for this request — first inside
      // resolveDurationOption (duration fallback) and again for the
      // unsupported-delivery-type gate. A single mockResolvedValueOnce would be
      // consumed by the duration-fallback call, leaving the gate to see the
      // default (supported) config and wrongly return 200.
      prisma.serviceBookingConfig.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/bookings/availability')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          employeeId: '65b0c5c9-e700-4e3f-ab13-a6f42d68b4d1',
          branchId: 'e4ce5937-1ba1-4f22-9ad1-c62d10961dde',
          date: tomorrow.toISOString(),
          serviceId: '6b5c1a2e-23d9-4328-88a6-b4a41b9ee524',
          deliveryType: 'ONLINE',
        })
        .expect(400);

      expect(res.body.message).toBe('Service does not support the requested delivery type');
    });
  });
});
