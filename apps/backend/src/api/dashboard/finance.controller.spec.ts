import { BadRequestException } from '@nestjs/common';
import { DashboardFinanceController } from './finance.controller';

describe('DashboardFinanceController', () => {
  let controller: DashboardFinanceController;
  let handlers: Record<string, jest.Mock>;

  beforeEach(() => {
    const handlerNames = [
      'createInvoice', 'getInvoice', 'processPayment', 'listPayments',
      'applyCoupon', 'listCoupons', 'getCoupon', 'createCoupon',
      'updateCoupon', 'deleteCoupon', 'getPaymentStats', 'refundPayment',
      'verifyPayment', 'bankTransferUpload', 'getMoyasarConfig',
      'upsertMoyasarConfig', 'testMoyasarConfig',
    ];

    handlers = {};
    const handlerMocks = handlerNames.map((name) => {
      const mock = jest.fn().mockResolvedValue({ id: name, success: true });
      handlers[name] = mock;
      return { execute: mock };
    });

    controller = new DashboardFinanceController(
      handlerMocks[0] as any,  // createInvoice
      handlerMocks[1] as any,  // getInvoice
      handlerMocks[2] as any,  // processPayment
      handlerMocks[3] as any,  // listPayments
      handlerMocks[4] as any,  // applyCoupon
      handlerMocks[5] as any,  // listCoupons
      handlerMocks[6] as any,  // getCoupon
      handlerMocks[7] as any,  // createCoupon
      handlerMocks[8] as any,  // updateCoupon
      handlerMocks[9] as any,  // deleteCoupon
      handlerMocks[10] as any, // getPaymentStats
      handlerMocks[11] as any, // refundPayment
      handlerMocks[12] as any, // verifyPayment
      handlerMocks[13] as any, // bankTransferUpload
      handlerMocks[14] as any, // getMoyasarConfig
      handlerMocks[15] as any, // upsertMoyasarConfig
      handlerMocks[16] as any, // testMoyasarConfig
    );
  });

  it('should be defined', () => expect(controller).toBeDefined());

  // ── Invoices ──────────────────────────────────────────────────────────────

  it('createInv should call createInvoice.execute with parsed dueAt', async () => {
    const body = { clientId: 'c1', items: [], dueAt: '2026-01-01T00:00:00Z' };
    await controller.createInv(body as any);
    expect(handlers.createInvoice).toHaveBeenCalledWith({ ...body, dueAt: new Date(body.dueAt) });
  });

  it('createInv should omit dueAt when not provided', async () => {
    const body = { clientId: 'c1', items: [] };
    await controller.createInv(body as any);
    expect(handlers.createInvoice).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'c1', items: [] }));
  });

  it('getInv should call getInvoice.execute', async () => {
    await controller.getInv('inv-1');
    expect(handlers.getInvoice).toHaveBeenCalledWith({ invoiceId: 'inv-1' });
  });

  // ── Payments ──────────────────────────────────────────────────────────────

  it('getPaymentStatsEndpoint should call getPaymentStats.execute', async () => {
    await controller.getPaymentStatsEndpoint();
    expect(handlers.getPaymentStats).toHaveBeenCalledWith();
  });

  it('processPaymentEndpoint should call processPayment.execute', async () => {
    const body = { invoiceId: 'inv-1', amount: 100, method: 'card' as const } as any;
    await controller.processPaymentEndpoint(body);
    expect(handlers.processPayment).toHaveBeenCalledWith(body);
  });

  it('bankTransferEndpoint should throw when file missing', () => {
    expect(() => controller.bankTransferEndpoint(undefined, { invoiceId: 'inv-1', clientId: 'c1', amount: 100 } as any)).toThrow(BadRequestException);
  });

  it('bankTransferEndpoint should call bankTransferUpload.execute with file', async () => {
    const file = { buffer: Buffer.from('data'), mimetype: 'image/png', originalname: 'receipt.png' } as Express.Multer.File;
    const body = { invoiceId: 'inv-1', clientId: 'c1', amount: 100 };
    await controller.bankTransferEndpoint(file, body as any);
    expect(handlers.bankTransferUpload).toHaveBeenCalledWith({
      ...body,
      fileBuffer: file.buffer,
      mimetype: file.mimetype,
      filename: file.originalname,
    });
  });

  it('listPaymentsEndpoint should call listPayments.execute with inclusive Asia/Riyadh date bounds', async () => {
    const query = { page: 1, limit: 10, fromDate: '2026-01-01', toDate: '2026-01-31', invoiceId: 'inv-1', clientId: 'c1', method: 'card' as const, status: 'COMPLETED' as const };
    await controller.listPaymentsEndpoint(query as any);
    expect(handlers.listPayments).toHaveBeenCalledWith({
      page: 1, limit: 10, invoiceId: 'inv-1', clientId: 'c1', method: 'card', status: 'COMPLETED',
      // Asia/Riyadh is +03:00 fixed offset (no DST): start-of-day 00:00 +03:00 == 21:00 UTC previous day,
      // end-of-day 23:59:59.999 +03:00 == 20:59:59.999 UTC same day.
      fromDate: new Date('2026-01-01T00:00:00+03:00'),
      toDate: new Date('2026-01-31T23:59:59.999+03:00'),
    });
  });

  it('listPaymentsEndpoint should omit dates when not provided', async () => {
    const query = { page: 1, limit: 10 };
    await controller.listPaymentsEndpoint(query as any);
    expect(handlers.listPayments).toHaveBeenCalledWith(expect.objectContaining({
      page: 1, limit: 10, fromDate: undefined, toDate: undefined,
    }));
  });

  it('refundPaymentEndpoint should call refundPayment.execute', async () => {
    const body = { amount: 50, reason: 'Refund' };
    await controller.refundPaymentEndpoint('pay-1', body);
    expect(handlers.refundPayment).toHaveBeenCalledWith({ paymentId: 'pay-1', ...body });
  });

  it('verifyPaymentEndpoint should call verifyPayment.execute', async () => {
    const body = { action: 'approve' as const, transferRef: 'TRF-001' };
    await controller.verifyPaymentEndpoint('pay-1', body);
    expect(handlers.verifyPayment).toHaveBeenCalledWith({ paymentId: 'pay-1', ...body });
  });

  // ── Coupons ───────────────────────────────────────────────────────────────

  it('applyCouponEndpoint should call applyCoupon.execute', async () => {
    const body = { invoiceId: 'inv-1', clientId: 'c1', code: 'SAVE10' };
    await controller.applyCouponEndpoint(body);
    expect(handlers.applyCoupon).toHaveBeenCalledWith(body);
  });

  it('listCouponsEndpoint should call listCoupons.execute', async () => {
    const query = { page: 1, limit: 10 };
    await controller.listCouponsEndpoint(query as any);
    expect(handlers.listCoupons).toHaveBeenCalledWith(query);
  });

  it('getCouponEndpoint should call getCoupon.execute', async () => {
    await controller.getCouponEndpoint('coupon-1');
    expect(handlers.getCoupon).toHaveBeenCalledWith({ couponId: 'coupon-1' });
  });

  it('createCouponEndpoint should call createCoupon.execute', async () => {
    const body = { code: 'SAVE10', discountType: 'percentage' as const, discountValue: 10 };
    await controller.createCouponEndpoint(body as any);
    expect(handlers.createCoupon).toHaveBeenCalledWith(body);
  });

  it('updateCouponEndpoint should call updateCoupon.execute', async () => {
    const body = { code: 'SAVE20' };
    await controller.updateCouponEndpoint('coupon-1', body as any);
    expect(handlers.updateCoupon).toHaveBeenCalledWith({ couponId: 'coupon-1', ...body });
  });

  it('deleteCouponEndpoint should call deleteCoupon.execute', async () => {
    await controller.deleteCouponEndpoint('coupon-1');
    expect(handlers.deleteCoupon).toHaveBeenCalledWith({ couponId: 'coupon-1' });
  });

  // ── Moyasar config ────────────────────────────────────────────────────────

  it('getMoyasarConfigEndpoint should call getMoyasarConfig.execute', async () => {
    await controller.getMoyasarConfigEndpoint();
    expect(handlers.getMoyasarConfig).toHaveBeenCalledWith();
  });

  it('upsertMoyasarConfigEndpoint should call upsertMoyasarConfig.execute', async () => {
    const body = { secretKey: 'sk_test_xxx', publishableKey: 'pk_test_xxx' };
    await controller.upsertMoyasarConfigEndpoint(body as any);
    expect(handlers.upsertMoyasarConfig).toHaveBeenCalledWith(body);
  });

  it('testMoyasarConfigEndpoint should call testMoyasarConfig.execute', async () => {
    await controller.testMoyasarConfigEndpoint();
    expect(handlers.testMoyasarConfig).toHaveBeenCalledWith();
  });
});
