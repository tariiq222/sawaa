import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ClientSessionGuard } from '../../../common/guards/client-session.guard';
import { EnrollInProgramHandler } from '../../../modules/bookings/enroll-in-program/enroll-in-program.handler';
import { MobileClientProgramsController } from './programs.controller';

describe('MobileClientProgramsController', () => {
  let app: INestApplication;
  const enroll = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MobileClientProgramsController],
      providers: [{ provide: EnrollInProgramHandler, useValue: enroll }],
    })
      .overrideGuard(ClientSessionGuard)
      .useValue({
        canActivate: (ctx: any) => {
          const req = ctx.switchToHttp().getRequest();
          if (!req.headers.authorization) return false;
          req.user = { id: 'client-1', email: null, phone: null };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => app.close());
  afterEach(() => jest.clearAllMocks());

  it('enrolls using the authenticated client and returns the handler result unchanged', async () => {
    const programId = '00000000-0000-4000-a000-000000000001';
    const result = {
      type: 'ENROLLED',
      bookingId: '00000000-0000-4000-a000-000000000002',
      status: 'AWAITING_PAYMENT',
      invoiceId: '00000000-0000-4000-a000-000000000003',
    };
    enroll.execute.mockResolvedValue(result);

    const response = await request(app.getHttpServer())
      .post(`/mobile/client/programs/${programId}/enroll`)
      .set('Authorization', 'Bearer fake')
      .send({ clientId: 'attacker-client' })
      .expect(201);

    expect(response.body).toEqual(result);
    expect(enroll.execute).toHaveBeenCalledWith({
      programId,
      clientId: 'client-1',
      public: true,
    });
  });

  it('rejects enrollment without a client session', async () => {
    await request(app.getHttpServer())
      .post('/mobile/client/programs/00000000-0000-4000-a000-000000000001/enroll')
      .expect(403);

    expect(enroll.execute).not.toHaveBeenCalled();
  });

  it('rejects an invalid program UUID before invoking the handler', async () => {
    await request(app.getHttpServer())
      .post('/mobile/client/programs/not-a-uuid/enroll')
      .set('Authorization', 'Bearer fake')
      .expect(400);

    expect(enroll.execute).not.toHaveBeenCalled();
  });
});
