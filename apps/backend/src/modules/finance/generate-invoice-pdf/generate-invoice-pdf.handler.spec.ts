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
      payment: { findFirst: jest.fn().mockResolvedValue(null) },
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

  it('returns the existing key without re-rendering when a PDF already exists', async () => {
    prisma.invoice.findUnique.mockResolvedValue({
      ...baseInvoice,
      pdfUrl: 'invoices/inv-1/1700000000000.pdf',
    });
    const key = await handler.execute({ invoiceId: 'inv-1' });
    expect(key).toBe('invoices/inv-1/1700000000000.pdf');
    expect(renderer.render).not.toHaveBeenCalled();
    expect(storage.uploadFile).not.toHaveBeenCalled();
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it('renders, uploads, and persists the storage key for a paid invoice', async () => {
    prisma.invoice.findUnique.mockResolvedValue({ ...baseInvoice, status: 'PAID', paidAt: new Date() });

    const key = await handler.execute({ invoiceId: 'inv-1' });

    expect(renderer.render).toHaveBeenCalled();
    expect(storage.uploadFile).toHaveBeenCalledWith(
      'finance-invoices',
      expect.stringMatching(/^invoices\/inv-1\/\d+\.pdf$/),
      expect.any(Buffer),
      'application/pdf',
    );
    expect(key).toMatch(/^invoices\/inv-1\/\d+\.pdf$/);
    // Persists the storage KEY, never the raw public URL uploadFile returns.
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: expect.objectContaining({
        pdfUrl: key,
        pdfGeneratedAt: expect.any(Date),
      }),
    });
    expect(key).not.toContain('http');
  });

  it('returns a key for an unpaid invoice without persisting it as the invoice PDF', async () => {
    prisma.invoice.findUnique.mockResolvedValue(baseInvoice);

    const key = await handler.execute({ invoiceId: 'inv-1' });

    expect(key).toMatch(/^invoices\/inv-1\/\d+\.pdf$/);
    expect(storage.uploadFile).toHaveBeenCalled();
    // A pre-payment document must not look like an issued receipt.
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it('still lets the receipt handler issue the receipt after staff generated a pre-payment PDF', async () => {
    const invoice: any = { ...baseInvoice, vatAmt: 0, total: 10000 };
    prisma.invoice.findUnique.mockImplementation(async () => ({ ...invoice }));
    prisma.invoice.update.mockImplementation(async ({ data }: any) => Object.assign(invoice, data));
    prisma.invoice.updateMany = jest.fn().mockImplementation(async ({ where, data }: any) => {
      if (invoice.pdfUrl !== where.pdfUrl || invoice.status !== where.status) return { count: 0 };
      Object.assign(invoice, data);
      return { count: 1 };
    });
    prisma.outboxEvent = { create: jest.fn() };

    await handler.execute({ invoiceId: 'inv-1' }); // staff, while still unpaid
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
    expect(invoice.pdfUrl).toEqual(expect.any(String));
    expect(prisma.outboxEvent.create).toHaveBeenCalledTimes(1);
  });
});
