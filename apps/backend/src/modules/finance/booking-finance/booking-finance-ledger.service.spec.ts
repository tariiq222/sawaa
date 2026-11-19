import { PaymentStatus, Prisma } from '@prisma/client';
import {
  BookingFinanceLedgerService,
  BLOCKING_PAYMENT_STATUSES,
} from './booking-finance-ledger.service';
import {
  BookingHasBlockingPaymentError,
  BookingInvoiceAlreadyExistsError,
} from './booking-finance-ledger.types';

type MockTx = {
  invoice: {
    findUnique: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };
  coupon: {
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  payment: {
    findFirst: jest.Mock;
    deleteMany: jest.Mock;
  };
  refundRequest: { deleteMany: jest.Mock };
  paymentCollectionIdempotency: { deleteMany: jest.Mock };
  organizationSettings: { findFirst: jest.Mock };
  $queryRaw: jest.Mock;
};

const buildTx = (): MockTx => ({
  invoice: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() },
  coupon: { update: jest.fn(), updateMany: jest.fn() },
  payment: { findFirst: jest.fn(), deleteMany: jest.fn() },
  refundRequest: { deleteMany: jest.fn() },
  paymentCollectionIdempotency: { deleteMany: jest.fn() },
  organizationSettings: { findFirst: jest.fn() },
  $queryRaw: jest.fn(),
});

const invoiceRow = {
  id: 'inv-1',
  subtotal: new Prisma.Decimal('10000'),
  discountAmt: new Prisma.Decimal('0'),
  vatRate: new Prisma.Decimal('0'),
  vatAmt: new Prisma.Decimal('0'),
  total: new Prisma.Decimal('10000'),
  status: 'DRAFT',
  issuedAt: null,
};

describe('BookingFinanceLedgerService', () => {
  let service: BookingFinanceLedgerService;
  let tx: MockTx;

  beforeEach(() => {
    service = new BookingFinanceLedgerService();
    tx = buildTx();
  });

  const asTx = () => tx as unknown as Prisma.TransactionClient;

  const cmd = {
    bookingId: 'b-1',
    branchId: 'br-1',
    clientId: 'c-1',
    employeeId: 'e-1',
    subtotal: new Prisma.Decimal('10000'),
    issueMode: 'DRAFT' as const,
  };

  describe('createBookingInvoiceInTx', () => {
    it('creates a DRAFT invoice with zero VAT when no rate is supplied', async () => {
      tx.organizationSettings.findFirst.mockResolvedValue({ vatRate: '0' });
      tx.invoice.findUnique.mockResolvedValue(null);
      tx.invoice.create.mockResolvedValue(invoiceRow);

      const result = await service.createBookingInvoiceInTx(asTx(), cmd);

      expect(tx.invoice.create).toHaveBeenCalledTimes(1);
      const data = (tx.invoice.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
      expect(data.status).toBe('DRAFT');
      expect(data).not.toHaveProperty('issuedAt');
      expect(result.status).toBe('DRAFT');
    });

    it('subtracts the discount before applying VAT', async () => {
      tx.organizationSettings.findFirst.mockResolvedValue({ vatRate: '0.15' });
      tx.invoice.findUnique.mockResolvedValue(null);
      tx.invoice.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
        ...invoiceRow,
        ...data,
      }));

      const result = await service.createBookingInvoiceInTx(asTx(), {
        ...cmd,
        subtotal: new Prisma.Decimal('10000'),
        discountAmt: new Prisma.Decimal('2000'),
      });

      // vatBase 8000 * 0.15 = 1200; total 9200.
      expect(result.vatAmt.toString()).toBe('1200');
      expect(result.total.toString()).toBe('9200');
    });

    it('rejects a second invoice for the same booking', async () => {
      tx.organizationSettings.findFirst.mockResolvedValue({ vatRate: '0' });
      tx.invoice.findUnique.mockResolvedValue({ id: 'inv-existing' });

      await expect(service.createBookingInvoiceInTx(asTx(), cmd)).rejects.toBeInstanceOf(
        BookingInvoiceAlreadyExistsError,
      );
      expect(tx.invoice.create).not.toHaveBeenCalled();
    });

    it('requires issuedAt when issueMode is ISSUED', async () => {
      await expect(
        service.createBookingInvoiceInTx(asTx(), { ...cmd, issueMode: 'ISSUED' }),
      ).rejects.toThrow('issuedAt is required');
      expect(tx.invoice.create).not.toHaveBeenCalled();
    });

    it('writes issuedAt only for ISSUED invoices', async () => {
      tx.organizationSettings.findFirst.mockResolvedValue({ vatRate: '0' });
      tx.invoice.findUnique.mockResolvedValue(null);
      tx.invoice.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
        ...invoiceRow,
        ...data,
      }));

      const issuedAt = new Date('2026-02-01');
      await service.createBookingInvoiceInTx(asTx(), {
        ...cmd,
        issueMode: 'ISSUED',
        issuedAt,
      });

      const data = (tx.invoice.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
      expect(data.status).toBe('ISSUED');
      expect(data.issuedAt).toBe(issuedAt);
    });

    it('uses the explicit vatRate without reading OrganizationSettings', async () => {
      tx.invoice.findUnique.mockResolvedValue(null);
      tx.invoice.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
        ...invoiceRow,
        ...data,
      }));

      await service.createBookingInvoiceInTx(asTx(), {
        ...cmd,
        vatRate: new Prisma.Decimal('0.15'),
      });

      expect(tx.organizationSettings.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('ensureBookingInvoiceInTx', () => {
    it('returns null and writes nothing when an invoice exists', async () => {
      tx.invoice.findUnique.mockResolvedValue({ id: 'inv-existing' });
      await expect(service.ensureBookingInvoiceInTx(asTx(), cmd)).resolves.toBeNull();
      expect(tx.invoice.create).not.toHaveBeenCalled();
    });

    it('creates the invoice when none exists', async () => {
      tx.invoice.findUnique.mockResolvedValue(null);
      tx.organizationSettings.findFirst.mockResolvedValue({ vatRate: '0' });
      tx.invoice.create.mockResolvedValue(invoiceRow);
      await expect(service.ensureBookingInvoiceInTx(asTx(), cmd)).resolves.not.toBeNull();
      expect(tx.invoice.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('coupons', () => {
    it('increments used count by id', async () => {
      tx.coupon.update.mockResolvedValue({ id: 'coupon-1' });
      await service.consumeCouponUsageInTx(asTx(), { couponId: 'coupon-1' });
      expect(tx.coupon.update).toHaveBeenCalledWith({
        where: { id: 'coupon-1' },
        data: { usedCount: { increment: 1 } },
        select: { id: true },
      });
    });

    it('reports released=false when nothing was used', async () => {
      tx.coupon.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        service.releaseCouponUsageInTx(asTx(), { code: 'SAVE10' }),
      ).resolves.toEqual({ released: false });
    });

    it('reports released=true when a row was decremented', async () => {
      tx.coupon.updateMany.mockResolvedValue({ count: 1 });
      await expect(
        service.releaseCouponUsageInTx(asTx(), { code: 'SAVE10' }),
      ).resolves.toEqual({ released: true });
    });
  });

  describe('deleteBookingInvoiceAndFinancialsInTx', () => {
    it('returns null and touches nothing when the booking has no invoice', async () => {
      tx.$queryRaw.mockResolvedValueOnce([]);
      await expect(
        service.deleteBookingInvoiceAndFinancialsInTx(asTx(), { bookingId: 'b-1' }),
      ).resolves.toEqual({ invoiceId: null });
      expect(tx.invoice.delete).not.toHaveBeenCalled();
    });

    it('locks invoice → idempotency → refund → payment, then deletes in the same order', async () => {
      tx.$queryRaw
        .mockResolvedValueOnce([{ id: 'inv-1' }]) // Invoice
        .mockResolvedValueOnce([]) // PaymentCollectionIdempotency
        .mockResolvedValueOnce([]) // RefundRequest
        .mockResolvedValueOnce([]); // Payment
      tx.payment.findFirst.mockResolvedValue(null);
      tx.refundRequest.deleteMany.mockResolvedValue({ count: 0 });
      tx.paymentCollectionIdempotency.deleteMany.mockResolvedValue({ count: 0 });
      tx.payment.deleteMany.mockResolvedValue({ count: 0 });
      tx.invoice.delete.mockResolvedValue({ id: 'inv-1' });

      const result = await service.deleteBookingInvoiceAndFinancialsInTx(asTx(), {
        bookingId: 'b-1',
      });

      // `$queryRaw` is called as a tagged template, so the first argument is
      // the strings array (not a Prisma.Sql object like `Prisma.sql` calls).
      const lockedTables = (tx.$queryRaw.mock.calls as unknown[][]).map((call) =>
        Array.isArray(call[0]) ? (call[0] as string[]).join('?') : String(call[0]),
      );
      expect(lockedTables[0]).toContain('"Invoice"');
      expect(lockedTables[1]).toContain('"PaymentCollectionIdempotency"');
      expect(lockedTables[2]).toContain('"RefundRequest"');
      expect(lockedTables[3]).toContain('"Payment"');
      expect(lockedTables[0]).toContain('FOR UPDATE NOWAIT');

      expect(result).toEqual({ invoiceId: 'inv-1' });
      expect(tx.invoice.delete).toHaveBeenCalledWith({ where: { id: 'inv-1' } });
    });

    it('refuses to delete when a blocking payment exists', async () => {
      tx.$queryRaw
        .mockResolvedValueOnce([{ id: 'inv-1' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      tx.payment.findFirst.mockResolvedValue({ id: 'pay-1' });

      await expect(
        service.deleteBookingInvoiceAndFinancialsInTx(asTx(), { bookingId: 'b-1' }),
      ).rejects.toBeInstanceOf(BookingHasBlockingPaymentError);
      expect(tx.invoice.delete).not.toHaveBeenCalled();
      expect(tx.payment.deleteMany).not.toHaveBeenCalled();
    });

    it('treats exactly the four finance statuses as blocking', () => {
      expect([...BLOCKING_PAYMENT_STATUSES].sort()).toEqual(
        [
          PaymentStatus.COMPLETED,
          PaymentStatus.PARTIALLY_REFUNDED,
          PaymentStatus.REFUNDED,
          PaymentStatus.PENDING_VERIFICATION,
        ].sort(),
      );
    });
  });
});
