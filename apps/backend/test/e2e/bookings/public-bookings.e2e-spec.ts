import { INestApplication } from '@nestjs/common';
import { createTestApp, request, MockPrisma } from '../../helpers/create-test-app';

describe('Public Bookings (e2e)', () => {
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

  it('GET /api/v1/public/branches returns branches list', async () => {
    prisma.branch.findMany.mockResolvedValue([
      { id: 'b1', name: 'Main Branch', nameAr: 'الفرع الرئيسي', isActive: true },
    ]);

    const res = await request(app.getHttpServer())
      .get('/api/v1/public/branches')
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Main Branch');
  });

  it('GET /api/v1/public/services returns active services', async () => {
    prisma.service.findMany.mockResolvedValue([
      { id: 's1', name: 'Consultation', nameAr: 'استشارة', price: 100, durationMins: 30, isActive: true },
    ]);

    const res = await request(app.getHttpServer())
      .get('/api/v1/public/services')
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Consultation');
  });

  it('GET /api/v1/public/employees returns public employees', async () => {
    prisma.employee.findMany.mockResolvedValue([
      { id: 'e1', name: 'Dr. Sara', nameAr: 'د. سارة', specialty: 'Dentist', isActive: true },
    ]);

    const res = await request(app.getHttpServer())
      .get('/api/v1/public/employees')
      .expect(200);

    expect(res.body).toHaveLength(1);
  });

  it('GET /api/v1/public/group-sessions returns open sessions', async () => {
    prisma.groupSession.findMany.mockResolvedValue([
      {
        id: 'gs1',
        title: 'Yoga',
        scheduledAt: new Date('2026-12-01'),
        durationMins: 60,
        maxCapacity: 10,
        enrolledCount: 3,
        price: 50,
        currency: 'SAR',
        status: 'OPEN',
        waitlistEnabled: false,
        waitlistCount: 0,
        employeeId: 'e1',
        serviceId: 's1',
      },
    ]);

    const res = await request(app.getHttpServer())
      .get('/api/v1/public/bookings/group-sessions')
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Yoga');
  });
});
