import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PackagePurchaseStatus } from '@prisma/client';
import { ClientSessionGuard } from '../../../common/guards/client-session.guard';
import { ListClientPackagePurchasesHandler } from '../../../modules/finance/package-purchases/list-client-package-purchases/list-client-package-purchases.handler';
import { ClientPackageBookHandler } from '../../../modules/bookings/client/client-package-book.handler';
import { ClientPackagePurchaseStatusHandler } from '../../../modules/bookings/client/client-package-purchase-status.handler';
import { MobileClientPackagesController } from './packages.controller';

describe('MobileClientPackagesController', () => {
  let app: INestApplication;
  const list = { execute: jest.fn() };
  const status = { execute: jest.fn() };
  const book = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MobileClientPackagesController],
      providers: [
        { provide: ListClientPackagePurchasesHandler, useValue: list },
        { provide: ClientPackagePurchaseStatusHandler, useValue: status },
        { provide: ClientPackageBookHandler, useValue: book },
      ],
    })
      .overrideGuard(ClientSessionGuard)
      .useValue({
        canActivate: (ctx: any) => {
          ctx.switchToHttp().getRequest().user = { id: 'client-1', email: null, phone: null };
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

  it('lists purchases for the session client and supports status filtering', async () => {
    list.execute.mockResolvedValue([{ id: 'purchase-1', notes: 'internal note' }]);

    const response = await request(app.getHttpServer())
      .get('/mobile/client/packages/purchases?status=PENDING')
      .set('Authorization', 'Bearer fake')
      .expect(200);

    expect(response.body).toEqual([{ id: 'purchase-1' }]);
    expect(response.body[0]).not.toHaveProperty('notes');
    expect(list.execute).toHaveBeenCalledWith({
      clientId: 'client-1',
      status: PackagePurchaseStatus.PENDING,
    });
  });

  it('reads purchase status using the session client', async () => {
    const purchaseId = '00000000-0000-4000-a000-000000000010';
    status.execute.mockResolvedValue({ id: purchaseId, status: PackagePurchaseStatus.PENDING });

    await request(app.getHttpServer())
      .get(`/mobile/client/packages/purchases/${purchaseId}`)
      .set('Authorization', 'Bearer fake')
      .expect(200);

    expect(status.execute).toHaveBeenCalledWith(purchaseId, 'client-1');
  });

  it('supports the website public-me package route alias', async () => {
    list.execute.mockResolvedValue([]);

    await request(app.getHttpServer())
      .get('/public/me/packages/purchases')
      .set('Authorization', 'Bearer fake')
      .expect(200);

    expect(list.execute).toHaveBeenCalledWith({ clientId: 'client-1', status: undefined });
  });

  it('rejects clientId/userId overrides instead of forwarding them', async () => {
    await request(app.getHttpServer())
      .post('/mobile/client/packages/book')
      .set('Authorization', 'Bearer fake')
      .send({
        creditId: '00000000-0000-4000-a000-000000000001',
        branchId: '00000000-0000-4000-a000-000000000002',
        scheduledAt: '2026-12-01T10:00:00.000Z',
        clientId: 'client-2',
        userId: 'user-2',
      })
      .expect(400);

    expect(book.execute).not.toHaveBeenCalled();
  });

  it('books with the authenticated client identity only', async () => {
    book.execute.mockResolvedValue({ id: 'booking-1' });

    await request(app.getHttpServer())
      .post('/mobile/client/packages/book')
      .set('Authorization', 'Bearer fake')
      .send({
        creditId: '00000000-0000-4000-a000-000000000001',
        branchId: '00000000-0000-4000-a000-000000000002',
        scheduledAt: '2026-12-01T10:00:00.000Z',
      })
      .expect(201);

    expect(book.execute).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'client-1' }));
    expect(book.execute.mock.calls[0][0]).not.toHaveProperty('userId');
  });
});
