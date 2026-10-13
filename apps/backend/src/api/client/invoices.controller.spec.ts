import { INestApplication, NotFoundException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ClientInvoicesController } from './invoices.controller';
import { ClientSessionGuard } from '../../common/guards/client-session.guard';
import { MinioService } from '../../infrastructure/storage/minio.service';
import { GetPublicInvoiceHandler } from '../../modules/finance/get-invoice/get-public-invoice.handler';
import { ListClientInvoicesHandler } from '../../modules/finance/list-client-invoices/list-client-invoices.handler';

const ID = '11111111-1111-4111-8111-111111111111';

describe('ClientInvoicesController', () => {
  let app: INestApplication;
  const list = { execute: jest.fn() };
  const getInvoice = { execute: jest.fn() };
  const storage = { getSignedUrl: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ClientInvoicesController],
      providers: [
        { provide: ListClientInvoicesHandler, useValue: list },
        { provide: GetPublicInvoiceHandler, useValue: getInvoice },
        { provide: MinioService, useValue: storage },
      ],
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

  it('GET / forwards page and pageSize', async () => {
    list.execute.mockResolvedValue({ items: [], total: 0, page: 3, pageSize: 7, outstandingBalance: 0 });
    await request(app.getHttpServer()).get('/client/invoices?page=3&pageSize=7').expect(200);
    expect(list.execute).toHaveBeenCalledWith('client-1', 3, 7);
  });

  it('GET / defaults to page 1, size 20', async () => {
    list.execute.mockResolvedValue({});
    await request(app.getHttpServer()).get('/client/invoices').expect(200);
    expect(list.execute).toHaveBeenCalledWith('client-1', 1, 20);
  });

  it('GET /:id returns the invoice scoped to the client', async () => {
    getInvoice.execute.mockResolvedValue({ id: ID, pdfUrl: 'receipts/inv.pdf' });
    const res = await request(app.getHttpServer()).get(`/client/invoices/${ID}`).expect(200);
    expect(getInvoice.execute).toHaveBeenCalledWith(ID, 'client-1');
    expect(res.body).toEqual({ id: ID, hasReceipt: true });
    expect(res.body).not.toHaveProperty('pdfUrl');
  });

  it('GET /:id reports hasReceipt=false when no receipt key exists', async () => {
    getInvoice.execute.mockResolvedValue({ id: ID, pdfUrl: null });
    const res = await request(app.getHttpServer()).get(`/client/invoices/${ID}`).expect(200);
    expect(res.body).toEqual({ id: ID, hasReceipt: false });
  });

  it('GET /:id passes a 404 through', async () => {
    getInvoice.execute.mockRejectedValue(new NotFoundException('Invoice not found'));
    await request(app.getHttpServer()).get(`/client/invoices/${ID}`).expect(404);
  });

  it('GET /:id/pdf returns a presigned URL with a 300s expiry', async () => {
    getInvoice.execute.mockResolvedValue({ id: ID, pdfUrl: 'receipts/inv.pdf' });
    storage.getSignedUrl.mockResolvedValue('https://signed');
    const res = await request(app.getHttpServer()).get(`/client/invoices/${ID}/pdf`).expect(200);
    expect(res.body).toEqual({ url: 'https://signed' });
    expect(storage.getSignedUrl).toHaveBeenCalledWith(expect.any(String), expect.any(String), 300);
  });

  it('GET /:id/pdf is 404 when no receipt was issued', async () => {
    getInvoice.execute.mockResolvedValue({ id: ID, pdfUrl: null });
    await request(app.getHttpServer()).get(`/client/invoices/${ID}/pdf`).expect(404);
    expect(storage.getSignedUrl).not.toHaveBeenCalled();
  });
});
