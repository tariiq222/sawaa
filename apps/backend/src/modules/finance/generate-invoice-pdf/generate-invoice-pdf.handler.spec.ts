import { NotFoundException } from '@nestjs/common';
import { GenerateInvoicePdfHandler } from './generate-invoice-pdf.handler';
import { IssueInvoiceReceiptHandler } from '../issue-invoice-receipt/issue-invoice-receipt.handler';

describe('GenerateInvoicePdfHandler', () => {
  let handler: GenerateInvoicePdfHandler;
  let prisma: any;
  let renderer: any;
  let storage: any;
  let cls: any;

  const baseInvoice = {
    id: 'inv-1',
    number: 42,
    status: 'UNPAID',
    pdfUrl: null,
    clientId: 'c1',
    bookingId: 'b1',
    subtotal: 10000,
    discountAmt: 0,
    vatAmt: 1500,
    total: 11500,
    currency: 'SAR',
    issuedAt: new Date(),
    paidAt: null,
  };

  beforeEach(() => {
    prisma = {
      invoice: { findUnique: jest.fn(), update: jest.fn() },
      organizationSettings: {
        findFirst: jest.fn().mockResolvedValue({
          companyNameAr: 'مركز سواء',
          vatRegistrationNumber: null,
          sellerAddress: null,
        }),
      },
      brandingConfig: {
        findFirst: jest.fn().mockResolvedValue({ logoUrl: null, colorPrimary: null }),
      },
      client: {
        findUnique: jest.fn().mockResolvedValue({ firstName: 'فاطمة', lastName: '' }),
      },
      booking: {
        findFirst: jest.fn().mockResolvedValue({ serviceNameSnapshot: 'استشارة' }),
      },
      payment: { findMany: jest.fn().mockResolvedValue([]) },
    };
    renderer = { render: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 fake')) };
    storage = { uploadFile: jest.fn().mockResolvedValue('http://minio/finance-invoices/inv-1.pdf') };
    cls = { run: (fn: any) => fn(), set: jest.fn() };

    handler = new GenerateInvoicePdfHandler(prisma, renderer, storage, cls);
  });

  it('throws NotFound when the invoice does not exist', async () => {
    prisma.invoice.findUnique.mockResolvedValue(null);
    await expect(handler.execute({ invoiceId: 'missing' })).rejects.toBeInstanceOf(NotFoundException);
    expect(renderer.render).not.toHaveBeenCalled();
  });

  it('returns the frozen receipt key unchanged and never re-renders', async () => {
    prisma.invoice.findUnique.mockResolvedValue({
      ...baseInvoice,
      status: 'PAID',
      receiptPdfKey: 'receipts/inv-1/p1.pdf',
    });
    const key = await handler.execute({ invoiceId: 'inv-1' });
    expect(key).toBe('receipts/inv-1/p1.pdf');
    expect(renderer.render).not.toHaveBeenCalled();
    expect(storage.uploadFile).not.toHaveBeenCalled();
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it('renders a statement to the fixed statements key and never writes the Invoice', async () => {
    prisma.invoice.findUnique.mockResolvedValue(baseInvoice);

    const key = await handler.execute({ invoiceId: 'inv-1' });

    expect(key).toBe('statements/inv-1.pdf');
    expect(renderer.render).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'statement', paidAt: null }),
    );
    expect(storage.uploadFile).toHaveBeenCalledWith(
      'finance-invoices',
      'statements/inv-1.pdf',
      expect.any(Buffer),
      'application/pdf',
    );
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it('re-renders the statement for a legacy PAID invoice without a receipt, still without writing', async () => {
    prisma.invoice.findUnique.mockResolvedValue({
      ...baseInvoice,
      status: 'PAID',
      paidAt: new Date(),
      pdfUrl: 'invoices/inv-1/1700000000000.pdf',
    });

    const key = await handler.execute({ invoiceId: 'inv-1' });

    expect(key).toBe('statements/inv-1.pdf');
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it('still lets the receipt handler issue the receipt after staff generated a pre-payment PDF', async () => {
    const invoice: any = { ...baseInvoice, vatAmt: 0, total: 10000 };
    prisma.invoice.findUnique.mockImplementation(async () => ({ ...invoice }));
    prisma.invoice.update.mockImplementation(async ({ data }: any) => Object.assign(invoice, data));
    prisma.invoice.updateMany = jest.fn().mockImplementation(async ({ where, data }: any) => {
      if ((invoice.receiptIssuedAt ?? null) !== where.receiptIssuedAt || invoice.status !== where.status) return { count: 0 };
      Object.assign(invoice, data);
      return { count: 1 };
    });
    prisma.outboxEvent = { create: jest.fn() };

    await handler.execute({ invoiceId: 'inv-1' }); // staff statement, while still unpaid
    invoice.status = 'PAID';
    invoice.paidAt = new Date();

    const receipt = new IssueInvoiceReceiptHandler(
      prisma,
      renderer,
      storage,
      { publish: jest.fn() } as any,
      cls,
      { withTransaction: (fn: any) => fn(prisma) } as any,
    );
    await receipt.handle({ payload: { paymentId: 'p1', invoiceId: 'inv-1' } } as never);

    expect(renderer.render).toHaveBeenCalledTimes(2);
    expect(invoice.receiptPdfKey).toEqual(expect.any(String));
    expect(prisma.outboxEvent.create).toHaveBeenCalledTimes(1);
  });
});
