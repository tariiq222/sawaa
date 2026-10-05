import { IssueInvoiceReceiptHandler } from './issue-invoice-receipt.handler';

describe('IssueInvoiceReceiptHandler', () => {
  let handler: IssueInvoiceReceiptHandler;
  let prisma: any;
  let renderer: any;
  let storage: any;
  let eventBus: any;
  let cls: any;
  let rlsTransaction: any;

  beforeEach(() => {
    prisma = {
      invoice: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
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
      payment: {
        findFirst: jest.fn().mockResolvedValue({ method: 'CASH' }),
      },
    };
    prisma.outboxEvent = { create: jest.fn() };
    rlsTransaction = { withTransaction: jest.fn((fn: any) => fn(prisma)) };
    renderer = { render: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 fake')) };
    storage = {
      uploadFile: jest.fn().mockResolvedValue('http://minio/finance-invoices/inv-1.pdf'),
    };
    eventBus = { publish: jest.fn() };
    cls = { run: (fn: any) => fn(), set: jest.fn() };

    handler = new IssueInvoiceReceiptHandler(prisma, renderer, storage, eventBus, cls, rlsTransaction);
  });

  it('generates an accessible late-entry PDF without queuing delivery', async () => {
    prisma.invoice.findUnique.mockResolvedValue({id: 'inv-1', number: 42, status: 'PAID', pdfUrl: null, bookingId: 'b1', clientId: 'c1', subtotal: 15000, discountAmt: 0, vatAmt: 0, total: 15000, currency: 'SAR', issuedAt: new Date(), paidAt: new Date()});
    prisma.booking.findFirst.mockResolvedValue({lateEntryRecordedAt: new Date(), serviceNameSnapshot: 'Session'});
    await handler.handle({payload: {paymentId: 'p1', invoiceId: 'inv-1'}} as never);
    expect(renderer.render).toHaveBeenCalled();
    expect(prisma.invoice.updateMany).toHaveBeenCalled();
    expect(prisma.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('skips when invoice not found' , async () => {
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

  it('renders, uploads, and saves invoice metadata with its delivery event on PAID', async () => {
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
    // S2.3a: the invoice persists the storage KEY, NOT the raw public URL that
    // uploadFile returns. The key matches `invoices/<id>/<timestamp>.pdf`.
    expect(prisma.invoice.updateMany).toHaveBeenCalledWith({
      where: { id: 'inv-1', status: 'PAID', pdfUrl: null },
      data: expect.objectContaining({
        pdfUrl: expect.stringMatching(/^invoices\/inv-1\/\d+\.pdf$/),
        pdfGeneratedAt: expect.any(Date),
      }),
    });
    // The raw uploadFile URL must never be stored.
    const storedPdfUrl = prisma.invoice.updateMany.mock.calls[0][0].data.pdfUrl;
    expect(storedPdfUrl).not.toContain('http');
    // The issued event carries the same key (not a URL) for the email handler.
    expect(prisma.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'finance.invoice.receipt.issued',
        payload: expect.objectContaining({ payload: expect.objectContaining({
          invoiceId: 'inv-1', invoiceNumber: 42, pdfUrl: storedPdfUrl,
        }) }),
      }),
    });
  });
  describe('durable receipt delivery', () => {
    let invoice: any;
    let events: any[];
    let failOutbox: boolean;

    beforeEach(() => {
      invoice = { id: 'inv-1', number: 42, status: 'PAID', pdfUrl: null,
        clientId: 'c1', bookingId: 'b1', subtotal: 10000, discountAmt: 0,
        vatAmt: 0, total: 10000, currency: 'SAR', issuedAt: new Date(), paidAt: new Date() };
      events = [];
      failOutbox = false;
      prisma.invoice.findUnique.mockImplementation(async () => ({ ...invoice }));
      prisma.invoice.update.mockImplementation(async ({ data }: any) => Object.assign(invoice, data));
      // Model commit/rollback at the database boundary, keeping the real handler.
      rlsTransaction.withTransaction.mockImplementation(async (work: any) => {
        const draft = { ...invoice };
        const pending: any[] = [];
        const result = await work({
          invoice: { updateMany: async ({ where, data }: any) => {
            if (draft.pdfUrl !== where.pdfUrl || draft.status !== where.status) return { count: 0 };
            Object.assign(draft, data);
            return { count: 1 };
          } },
          outboxEvent: { create: async ({ data }: any) => {
            if (failOutbox) throw new Error('outbox write failed');
            pending.push(data);
            return data;
          } },
        });
        invoice = draft;
        events.push(...pending);
        return result;
      });
      eventBus.publish.mockRejectedValue(new Error('redis down'));
    });

    it('retains one deliverable event when Redis is unavailable and the payment is replayed', async () => {
      const payment = { payload: { paymentId: 'p1', invoiceId: 'inv-1' } } as any;
      await expect(handler.handle(payment)).resolves.toBeUndefined();
      await handler.handle(payment);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(expect.objectContaining({
        id: expect.any(String), aggregateId: 'inv-1',
        eventType: 'finance.invoice.receipt.issued', status: 'PENDING_V2', deliveryLane: 'PENDING_V2',
        payload: expect.objectContaining({ payload: expect.objectContaining({ pdfUrl: invoice.pdfUrl }) }),
      }));
      expect(events[0].payload.eventId).toBe(events[0].id);
      expect(renderer.render).toHaveBeenCalledTimes(1);
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('rolls back PDF metadata when the outbox write fails so the next attempt can deliver', async () => {
      const payment = { payload: { paymentId: 'p1', invoiceId: 'inv-1' } } as any;
      failOutbox = true;
      await expect(handler.handle(payment)).rejects.toThrow('outbox write failed');
      expect(invoice.pdfUrl).toBeNull();
      expect(events).toHaveLength(0);
      failOutbox = false;
      await handler.handle(payment);
      expect(invoice.pdfUrl).toEqual(expect.any(String));
      expect(events).toHaveLength(1);
    });

    it('does not replace a PDF or enqueue another event when another worker wins the invoice write', async () => {
      storage.uploadFile.mockImplementation(async () => { invoice.pdfUrl = 'invoices/inv-1/winner.pdf'; });
      await handler.handle({ payload: { paymentId: 'p1', invoiceId: 'inv-1' } } as any);
      expect(invoice.pdfUrl).toBe('invoices/inv-1/winner.pdf');
      expect(events).toHaveLength(0);
    });
  });

});
