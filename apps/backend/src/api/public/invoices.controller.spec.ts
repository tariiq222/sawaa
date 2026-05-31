import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PublicInvoicesController } from './invoices.controller';
import { GetPublicInvoiceHandler } from '../../modules/finance/get-invoice/get-public-invoice.handler';
import { MinioService } from '../../infrastructure/storage/minio.service';
import { ClientSessionGuard } from '../../common/guards/client-session.guard';

describe('PublicInvoicesController (e2e)', () => {
  let app: INestApplication;

  const mockGetInvoice = { execute: jest.fn() };
  const mockStorage = {
    getSignedUrl: jest.fn().mockResolvedValue('https://minio.test/presigned'),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PublicInvoicesController],
      providers: [
        { provide: GetPublicInvoiceHandler, useValue: mockGetInvoice },
        { provide: MinioService, useValue: mockStorage },
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

  describe('GET /public/invoices/:id/pdf', () => {
    it('returns a short-lived presigned URL derived from the stored object key', async () => {
      mockGetInvoice.execute.mockResolvedValue({
        id: '00000000-0000-4000-a000-000000000002',
        pdfUrl: 'invoices/00000000-0000-4000-a000-000000000002/1700000000000.pdf',
      });

      const res = await request(app.getHttpServer())
        .get('/public/invoices/00000000-0000-4000-a000-000000000002/pdf')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.url).toBe('https://minio.test/presigned');
      expect(mockStorage.getSignedUrl).toHaveBeenCalledWith(
        'finance-invoices',
        'invoices/00000000-0000-4000-a000-000000000002/1700000000000.pdf',
        300,
      );
    });

    it('normalises a legacy full URL back to the object key before presigning', async () => {
      mockGetInvoice.execute.mockResolvedValue({
        id: '00000000-0000-4000-a000-000000000003',
        pdfUrl:
          'http://localhost:9000/finance-invoices/invoices/00000000-0000-4000-a000-000000000003/42.pdf',
      });

      await request(app.getHttpServer())
        .get('/public/invoices/00000000-0000-4000-a000-000000000003/pdf')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(mockStorage.getSignedUrl).toHaveBeenCalledWith(
        'finance-invoices',
        'invoices/00000000-0000-4000-a000-000000000003/42.pdf',
        300,
      );
    });

    it('returns 404 when no PDF has been generated yet', async () => {
      mockGetInvoice.execute.mockResolvedValue({
        id: '00000000-0000-4000-a000-000000000004',
        pdfUrl: null,
      });

      await request(app.getHttpServer())
        .get('/public/invoices/00000000-0000-4000-a000-000000000004/pdf')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(404);

      expect(mockStorage.getSignedUrl).not.toHaveBeenCalled();
    });
  });
});
