import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { DashboardProgramsController } from './programs.controller';
import { CreateProgramHandler } from '../../modules/bookings/create-program/create-program.handler';
import { ListProgramsHandler } from '../../modules/bookings/list-programs/list-programs.handler';
import { GetProgramHandler } from '../../modules/bookings/get-program/get-program.handler';
import { PublishProgramHandler } from '../../modules/bookings/publish-program/publish-program.handler';
import { ScheduleProgramHandler } from '../../modules/bookings/schedule-program/schedule-program.handler';
import { CancelProgramHandler } from '../../modules/bookings/cancel-program/cancel-program.handler';
import { EnrollInProgramHandler } from '../../modules/bookings/enroll-in-program/enroll-in-program.handler';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';

/**
 * AUTHZ-001 regression spec: the dashboard programs controller must enforce
 * @CheckPermissions on every method. We exercise the REAL CaslGuard so that
 * an under-privileged role (EMPLOYEE / RECEPTIONIST) is forbidden and an
 * authorized role (ADMIN) is allowed.
 *
 * Only JwtGuard is overridden — to inject the role under test onto req.user.
 * CaslGuard runs for real and evaluates the controller's @CheckPermissions
 * metadata against BUILT_IN rules (req.user.permissions is intentionally left
 * empty so the guard falls back to buildForUser → BUILT_IN[role]).
 */
describe('DashboardProgramsController (authorization)', () => {
  let app: INestApplication;

  const mockCreate = { execute: jest.fn().mockResolvedValue({ id: 'p1' }) };
  const mockList = { execute: jest.fn().mockResolvedValue([]) };
  const mockGet = { execute: jest.fn().mockResolvedValue({ id: 'p1' }) };
  const mockPublish = { execute: jest.fn().mockResolvedValue({ id: 'p1' }) };
  const mockSchedule = { execute: jest.fn().mockResolvedValue({ id: 'p1' }) };
  const mockCancel = { execute: jest.fn().mockResolvedValue({ id: 'p1' }) };
  const mockEnroll = { execute: jest.fn().mockResolvedValue({ id: 'e1' }) };

  // Mutable holder so each test picks the role injected by the overridden JwtGuard.
  let currentRole: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DashboardProgramsController],
      providers: [
        Reflector,
        // The controller declares @UseGuards(JwtGuard, CaslGuard). We leave
        // CaslGuard un-overridden so the REAL guard runs; provide it + Reflector
        // so Nest can construct it via DI.
        CaslGuard,
        { provide: CreateProgramHandler, useValue: mockCreate },
        { provide: ListProgramsHandler, useValue: mockList },
        { provide: GetProgramHandler, useValue: mockGet },
        { provide: PublishProgramHandler, useValue: mockPublish },
        { provide: ScheduleProgramHandler, useValue: mockSchedule },
        { provide: CancelProgramHandler, useValue: mockCancel },
        { provide: EnrollInProgramHandler, useValue: mockEnroll },
      ],
    })
      // Override only JwtGuard: inject the role under test, leave permissions
      // empty so CaslGuard falls back to BUILT_IN[role].
      .overrideGuard(JwtGuard)
      .useValue({
        canActivate: (ctx: any) => {
          ctx.switchToHttp().getRequest().user = {
            sub: 'user-1',
            role: currentRole,
            customRole: null,
            permissions: [],
          };
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

  const uuid = '00000000-0000-4000-a000-000000000001';

  describe('write endpoints require manage:Booking', () => {
    it('forbids EMPLOYEE from creating a program', async () => {
      currentRole = 'EMPLOYEE';
      await request(app.getHttpServer())
        .post('/dashboard/programs')
        .send({})
        .expect(403);
      expect(mockCreate.execute).not.toHaveBeenCalled();
    });

    it('forbids RECEPTIONIST from creating a program', async () => {
      currentRole = 'RECEPTIONIST';
      await request(app.getHttpServer())
        .post('/dashboard/programs')
        .send({})
        .expect(403);
      expect(mockCreate.execute).not.toHaveBeenCalled();
    });

    it('forbids EMPLOYEE from publishing a program', async () => {
      currentRole = 'EMPLOYEE';
      await request(app.getHttpServer())
        .patch(`/dashboard/programs/${uuid}/publish`)
        .expect(403);
      expect(mockPublish.execute).not.toHaveBeenCalled();
    });

    it('forbids EMPLOYEE from cancelling a program', async () => {
      currentRole = 'EMPLOYEE';
      await request(app.getHttpServer())
        .patch(`/dashboard/programs/${uuid}/cancel`)
        .send({})
        .expect(403);
      expect(mockCancel.execute).not.toHaveBeenCalled();
    });

    it('forbids EMPLOYEE from enrolling a client', async () => {
      currentRole = 'EMPLOYEE';
      await request(app.getHttpServer())
        .post(`/dashboard/programs/${uuid}/enrollments`)
        .send({ clientId: '00000000-0000-4000-a000-000000000002' })
        .expect(403);
      expect(mockEnroll.execute).not.toHaveBeenCalled();
    });

    it('allows ADMIN to publish a program', async () => {
      currentRole = 'ADMIN';
      await request(app.getHttpServer())
        .patch(`/dashboard/programs/${uuid}/publish`)
        .expect(200);
      expect(mockPublish.execute).toHaveBeenCalledWith(uuid);
    });
  });

  describe('read endpoints require read:Booking', () => {
    it('allows EMPLOYEE to list programs (read:Booking)', async () => {
      currentRole = 'EMPLOYEE';
      await request(app.getHttpServer())
        .get('/dashboard/programs')
        .expect(200);
      expect(mockList.execute).toHaveBeenCalled();
    });

    it('forbids a role with no Booking permission from listing programs', async () => {
      // A role absent from BUILT_IN yields an empty ability → read:Booking denied.
      currentRole = 'UNKNOWN_ROLE';
      await request(app.getHttpServer())
        .get('/dashboard/programs')
        .expect(403);
      expect(mockList.execute).not.toHaveBeenCalled();
    });
  });
});
