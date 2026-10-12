import { INestApplication, NotFoundException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ClientRefundsController } from './refunds.controller';
import { ClientSessionGuard } from '../../common/guards/client-session.guard';
import { RequestRefundHandler } from '../../modules/finance/refund-payment/request-refund.handler';

const ID = '11111111-1111-4111-8111-111111111111';

describe('ClientRefundsController', () => {
  let app: INestApplication;
  const handler = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ClientRefundsController],
      providers: [{ provide: RequestRefundHandler, useValue: handler }],
    })
      .overrideGuard(ClientSessionGuard)
      .useValue({
        canActivate: (ctx: any) => {
          ctx.switchToHttp().getRequest().user = { id: 'client-1', email: null, phone: null, channel: 'web' };
          return true;
        },
      })
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => { await app.close(); });
  afterEach(() => jest.resetAllMocks());

  it('POST /request binds the session client', async () => {
    handler.execute.mockResolvedValue({ ok: true });
    await request(app.getHttpServer()).post('/client/refunds/request').send({ invoiceId: ID, reason: 'why' }).expect(201);
    expect(handler.execute).toHaveBeenCalledWith({ invoiceId: ID, reason: 'why', clientId: 'client-1' });
  });

  it('POST /request rejects a client-supplied clientId', async () => {
    await request(app.getHttpServer()).post('/client/refunds/request').send({ invoiceId: ID, clientId: 'other' }).expect(400);
    expect(handler.execute).not.toHaveBeenCalled();
  });

  it('POST /request passes a 404 through', async () => {
    handler.execute.mockRejectedValue(new NotFoundException('Invoice not found'));
    await request(app.getHttpServer()).post('/client/refunds/request').send({ invoiceId: ID }).expect(404);
  });
});
