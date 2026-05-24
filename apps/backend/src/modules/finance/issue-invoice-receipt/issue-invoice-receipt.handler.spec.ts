import { IssueInvoiceReceiptHandler } from './issue-invoice-receipt.handler';

describe('IssueInvoiceReceiptHandler', () => {
  let handler: IssueInvoiceReceiptHandler;
  let prisma: any;
  let renderer: any;
  let storage: any;
  let eventBus: any;
  let cls: any;

  beforeEach(() => {
    prisma = {
      invoice: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      organizationSettings: {
        findFirst: jest.fn().mockResolvedValue({
          companyNameAr: 'مركز سواء',
          vatRegistrationNumber: null,
          sellerAddress: null,
        }),
      },
      client: {
        findUnique: jest.fn().mockResolvedValue({ firstName: 'فاطمة', lastName: '' }),
      },
      booking: {
        findFirst: jest.fn().mockResolvedValue({ serviceNameSnapshot: 'استشارة' }),
      },
      payment: {
        findFirst: jest.fn().mockResolvedValue({ method: 'CASH' }),
      },
    };
    renderer = { render: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 fake')) };
    storage = {
      uploadFile: jest.fn().mockResolvedValue('http://minio/finance-invoices/inv-1.pdf'),
    };
    eventBus = { publish: jest.fn() };
    cls = { run: (fn: any) => fn(), set: jest.fn() };

    handler = new IssueInvoiceReceiptHandler(prisma, renderer, storage, eventBus, cls);
  });

  it('skips when invoice not found', async () => {
    prisma.invoice.findUnique.mockResolvedValue(null);
    await handler.handle({ payload: { paymentId: 'p1', invoiceId: 'missing' } } as any);
    expect(renderer.render).not.toHaveBeenCalled();
  });

  it('skips when invoice not PAID', async () => {
    prisma.invoice.findUnique.mockResolvedValue({ id: 'inv-1', status: 'PARTIALLY_PAID' });
    await handler.handle({ payload: { paymentId: 'p1', invoiceId: 'inv-1' } } as any);
    expect(renderer.render).not.toHaveBeenCalled();
  });

  it('skips when pdfUrl already set (idempotent)', async () => {
    prisma.invoice.findUnique.mockResolvedValue({
      id: 'inv-1',
      status: 'PAID',
      pdfUrl: 'http://existing.pdf',
    });
    await handler.handle({ payload: { paymentId: 'p1', invoiceId: 'inv-1' } } as any);
    expect(renderer.render).not.toHaveBeenCalled();
  });

  it('renders, uploads, updates invoice, and publishes event on PAID', async () => {
    prisma.invoice.findUnique.mockResolvedValue({
      id: 'inv-1',
      number: 42,
      status: 'PAID',
      pdfUrl: null,
      clientId: 'c1',
      bookingId: 'b1',
      subtotal: 10000,
      discountAmt: 0,
      vatAmt: 1500,
      total: 11500,
      currency: 'SAR',
      issuedAt: new Date(),
      paidAt: new Date(),
    });

    await handler.handle({
      payload: { paymentId: 'p1', invoiceId: 'inv-1', organizationId: 'org-1' },
    } as any);

    expect(renderer.render).toHaveBeenCalled();
    expect(storage.uploadFile).toHaveBeenCalledWith(
      'finance-invoices',
      expect.stringContaining('inv-1'),
      expect.any(Buffer),
      'application/pdf',
    );
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: expect.objectContaining({
        pdfUrl: 'http://minio/finance-invoices/inv-1.pdf',
        pdfGeneratedAt: expect.any(Date),
      }),
    });
    expect(eventBus.publish).toHaveBeenCalledWith(
      'finance.invoice.receipt.issued',
      expect.objectContaining({
        payload: expect.objectContaining({
          invoiceId: 'inv-1',
          invoiceNumber: 42,
          pdfUrl: 'http://minio/finance-invoices/inv-1.pdf',
        }),
      }),
    );
  });
});
