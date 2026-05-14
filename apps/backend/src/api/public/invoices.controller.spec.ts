import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PublicInvoicesController } from './invoices.controller';
import { GetPublicInvoiceHandler } from '../../modules/finance/get-invoice/get-public-invoice.handler';
import { ClientSessionGuard } from '../../common/guards/client-session.guard';

describe('PublicInvoicesController (e2e)', () => {
  let app: INestApplication;

  const mockGetInvoice = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PublicInvoicesController],
      providers: [
        { provide: GetPublicInvoiceHandler, useValue: mockGetInvoice },
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

  describe('GET /public/invoices/:id', () => {
    it('returns 200 with invoice details', async () => {
      mockGetInvoice.execute.mockResolvedValue({
        id: '00000000-0000-4000-a000-000000000001',
        total: 150,
        currency: 'SAR',
      });

      const res = await request(app.getHttpServer())
        .get('/public/invoices/00000000-0000-4000-a000-000000000001')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.total).toBe(150);
      expect(mockGetInvoice.execute).toHaveBeenCalledWith(
        '00000000-0000-4000-a000-000000000001',
        'client-1',
      );
    });

    it('returns 400 for invalid UUID', async () => {
      return request(app.getHttpServer())
        .get('/public/invoices/not-a-uuid')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
    });
  });
});
