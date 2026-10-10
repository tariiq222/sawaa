import { IssueInvoiceReceiptHandler } from './issue-invoice-receipt.handler';

const paidInvoice = () => ({
  id: 'inv-1', number: 42, status: 'PAID', receiptIssuedAt: null, clientId: 'c1',
  bookingId: 'b1', subtotal: 10000, discountAmt: 0, vatAmt: 0, total: 10000,
  currency: 'SAR', issuedAt: new Date(), paidAt: new Date(),
});

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
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([
          { method: 'CASH', amount: 6000, effectiveReceivedAt: null, processedAt: null, createdAt: new Date('2026-05-20T10:00:00Z') },
          { method: 'CARD', amount: 4000, effectiveReceivedAt: null, processedAt: new Date('2026-05-24T10:00:00Z'), createdAt: new Date('2026-05-24T09:00:00Z') },
        ]),
      },
    };
    prisma.outboxEvent = { create: jest.fn() };
    rlsTransaction = { withTransaction: jest.fn((fn: any) => fn(prisma)) };
    renderer = { render: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 fake')) };
    storage = {
      uploadFile: jest.fn().mockResolvedValue('http://minio/finance-invoices/inv-1.pdf'),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };
    eventBus = { publish: jest.fn() };
    cls = { run: (fn: any) => fn(), set: jest.fn() };

    handler = new IssueInvoiceReceiptHandler(prisma, renderer, storage, eventBus, cls, rlsTransaction);
  });

  it('generates an accessible late-entry PDF without queuing delivery', async () => {
    prisma.invoice.findUnique.mockResolvedValue({id: 'inv-1', number: 42, status: 'PAID', receiptIssuedAt: null, bookingId: 'b1', clientId: 'c1', subtotal: 15000, discountAmt: 0, vatAmt: 0, total: 15000, currency: 'SAR', issuedAt: new Date(), paidAt: new Date()});
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

  it('skips when a receipt was already issued (idempotent)', async () => {
    prisma.invoice.findUnique.mockResolvedValue({
      id: 'inv-1',
      status: 'PAID',
      receiptIssuedAt: new Date(),
    });
    await handler.handle({ payload: { paymentId: 'p1', invoiceId: 'inv-1' } } as any);
    expect(renderer.render).not.toHaveBeenCalled();
  });

  it('does NOT skip when only a legacy pdfUrl is set', async () => {
    prisma.invoice.findUnique.mockResolvedValue({ ...paidInvoice(), pdfUrl: 'invoices/inv-1/1.pdf' });
    await handler.handle({ payload: { paymentId: 'p1', invoiceId: 'inv-1' } } as any);
    expect(renderer.render).toHaveBeenCalled();
    expect(prisma.invoice.updateMany).toHaveBeenCalled();
    expect(prisma.outboxEvent.create).toHaveBeenCalled();
  });

  it('skips a replayed event when a valid legacy receipt (pdf generated at/after paidAt) exists', async () => {
    const paidAt = new Date('2026-05-24T10:05:00Z');
    prisma.invoice.findUnique.mockResolvedValue({
      ...paidInvoice(), paidAt, receiptPdfKey: null,
      pdfUrl: 'invoices/inv-1/2.pdf', pdfGeneratedAt: new Date('2026-05-24T10:06:00Z'),
    });
    await handler.handle({ payload: { paymentId: 'p1', invoiceId: 'inv-1' } } as any);
    expect(renderer.render).not.toHaveBeenCalled();
    expect(storage.uploadFile).not.toHaveBeenCalled();
    expect(prisma.invoice.updateMany).not.toHaveBeenCalled();
    expect(prisma.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('still issues when the legacy pdf was generated before paidAt (statement, not receipt)', async () => {
    const paidAt = new Date('2026-05-24T10:05:00Z');
    prisma.invoice.findUnique.mockResolvedValue({
      ...paidInvoice(), paidAt, receiptPdfKey: null,
      pdfUrl: 'invoices/inv-1/1.pdf', pdfGeneratedAt: new Date('2026-05-24T10:00:00Z'),
    });
    await handler.handle({ payload: { paymentId: 'p1', invoiceId: 'inv-1' } } as any);
    expect(renderer.render).toHaveBeenCalled();
    expect(prisma.outboxEvent.create).toHaveBeenCalled();
  });

  it('lists every settled payment (date, method, halalas) and uses paidAt in the rendered data', async () => {
    const paidAt = new Date('2026-05-24T10:05:00Z');
    prisma.invoice.findUnique.mockResolvedValue({ ...paidInvoice(), paidAt });
    await handler.handle({ payload: { paymentId: 'p1', invoiceId: 'inv-1' } } as any);
    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { invoiceId: 'inv-1', status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED'] } },
      }),
    );
    const data = renderer.render.mock.calls[0][0];
    expect(data.paidAt).toEqual(paidAt);
    expect(data.payments).toEqual([
      { date: new Date('2026-05-20T10:00:00Z'), method: 'CASH', amount: 6000, refundedAmount: 0 },
      { date: new Date('2026-05-24T10:00:00Z'), method: 'CARD', amount: 4000, refundedAmount: 0 },
    ]);
  });

  it('stores the receipt but queues no event when deliver is false', async () => {
    prisma.invoice.findUnique.mockResolvedValue(paidInvoice());
    await handler.issue('inv-1', 'p1', { deliver: false });
    expect(prisma.invoice.updateMany).toHaveBeenCalled();
    expect(prisma.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('queues no event and deletes the uploaded object when the guarded update loses', async () => {
    prisma.invoice.findUnique.mockResolvedValue(paidInvoice());
    prisma.invoice.updateMany.mockResolvedValue({ count: 0 });
    await handler.handle({ payload: { paymentId: 'p1', invoiceId: 'inv-1' } } as any);
    expect(prisma.outboxEvent.create).not.toHaveBeenCalled();
    expect(storage.deleteFile).toHaveBeenCalledWith('finance-invoices', expect.stringMatching(/^receipts\/inv-1\/p1-[0-9a-f-]{36}\.pdf$/));
  });

  it('guards the update against a legacy receipt committed by an old worker mid-flight', async () => {
    const paidAt = new Date('2026-05-24T10:05:00Z');
    prisma.invoice.findUnique.mockResolvedValue({ ...paidInvoice(), paidAt, receiptPdfKey: null, pdfUrl: null, pdfGeneratedAt: null });
    // Simulate the legacy guard excluding the row (an old worker committed first).
    prisma.invoice.updateMany.mockResolvedValue({ count: 0 });
    await handler.handle({ payload: { paymentId: 'p1', invoiceId: 'inv-1' } } as any);
    expect(prisma.invoice.updateMany.mock.calls[0][0].where).toEqual({
      id: 'inv-1', status: 'PAID', receiptIssuedAt: null,
      OR: [{ pdfUrl: null }, { pdfGeneratedAt: null }, { pdfGeneratedAt: { lt: paidAt } }],
    });
    expect(prisma.outboxEvent.create).not.toHaveBeenCalled();
    expect(storage.deleteFile).toHaveBeenCalledWith('finance-invoices', expect.stringMatching(/^receipts\/inv-1\/p1-/));
  });

  it('falls back to requiring pdfUrl null when paidAt is null', async () => {
    prisma.invoice.findUnique.mockResolvedValue({ ...paidInvoice(), paidAt: null, receiptPdfKey: null });
    await handler.handle({ payload: { paymentId: 'p1', invoiceId: 'inv-1' } } as any);
    expect(prisma.invoice.updateMany.mock.calls[0][0].where).toEqual({
      id: 'inv-1', status: 'PAID', receiptIssuedAt: null, pdfUrl: null,
    });
  });

  it('uses a distinct key per attempt and the loser deletes exactly its own key', async () => {
    prisma.invoice.findUnique.mockResolvedValue(paidInvoice());
    prisma.invoice.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    await handler.issue('inv-1', 'p1');
    await handler.issue('inv-1', 'p1');
    const [winnerKey, loserKey] = storage.uploadFile.mock.calls.map((c: any[]) => c[1]);
    expect(winnerKey).not.toBe(loserKey);
    expect(prisma.invoice.updateMany.mock.calls[0][0].data.receiptPdfKey).toBe(winnerKey);
    expect(storage.deleteFile).toHaveBeenCalledTimes(1);
    expect(storage.deleteFile).toHaveBeenCalledWith('finance-invoices', loserKey);
  });

  it('renders, uploads, and saves invoice metadata with its delivery event on PAID', async () => {
    prisma.invoice.findUnique.mockResolvedValue({
      id: 'inv-1',
      number: 42,
      status: 'PAID',
      receiptIssuedAt: null,
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
    // uploadFile returns. The key is `receipts/<invoiceId>/<paymentId>.pdf`.
    expect(prisma.invoice.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'inv-1', status: 'PAID', receiptIssuedAt: null,
        OR: [{ pdfUrl: null }, { pdfGeneratedAt: null }, { pdfGeneratedAt: { lt: expect.any(Date) } }],
      },
      data: {
        receiptPdfKey: expect.stringMatching(/^receipts\/inv-1\/p1-[0-9a-f-]{36}\.pdf$/),
        receiptIssuedAt: expect.any(Date),
        receiptPaymentId: 'p1',
        // Legacy columns dual-written for rollback / mixed-version readers.
        pdfUrl: expect.stringMatching(/^receipts\/inv-1\/p1-[0-9a-f-]{36}\.pdf$/),
        pdfGeneratedAt: expect.any(Date),
      },
    });
    const written = prisma.invoice.updateMany.mock.calls[0][0].data;
    expect(written.pdfGeneratedAt).toBe(written.receiptIssuedAt);
    // The raw uploadFile URL must never be stored.
    const storedPdfUrl = prisma.invoice.updateMany.mock.calls[0][0].data.receiptPdfKey;
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
      invoice = { id: 'inv-1', number: 42, status: 'PAID', receiptIssuedAt: null,
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
            if (draft.receiptIssuedAt !== where.receiptIssuedAt || draft.status !== where.status) return { count: 0 };
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
        payload: expect.objectContaining({ payload: expect.objectContaining({ pdfUrl: invoice.receiptPdfKey }) }),
      }));
      expect(events[0].payload.eventId).toBe(events[0].id);
      expect(renderer.render).toHaveBeenCalledTimes(1);
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('rolls back PDF metadata when the outbox write fails so the next attempt can deliver', async () => {
      const payment = { payload: { paymentId: 'p1', invoiceId: 'inv-1' } } as any;
      failOutbox = true;
      await expect(handler.handle(payment)).rejects.toThrow('outbox write failed');
      expect(invoice.receiptPdfKey).toBeUndefined();
      expect(invoice.receiptIssuedAt).toBeNull();
      expect(events).toHaveLength(0);
      failOutbox = false;
      await handler.handle(payment);
      expect(invoice.receiptPdfKey).toEqual(expect.any(String));
      expect(events).toHaveLength(1);
    });

    it('does not replace a PDF or enqueue another event when another worker wins the invoice write', async () => {
      storage.uploadFile.mockImplementation(async () => { invoice.receiptIssuedAt = new Date(); invoice.receiptPdfKey = 'receipts/inv-1/winner.pdf'; });
      await handler.handle({ payload: { paymentId: 'p1', invoiceId: 'inv-1' } } as any);
      expect(invoice.receiptPdfKey).toBe('receipts/inv-1/winner.pdf');
      expect(storage.deleteFile).toHaveBeenCalledWith('finance-invoices', expect.stringMatching(/^receipts\/inv-1\/p1-[0-9a-f-]{36}\.pdf$/));
      expect(events).toHaveLength(0);
    });
  });


  it('skips a previous-receipt invoice: no render, upload or outbox', async () => {
    prisma.invoice.findUnique.mockResolvedValue(paidInvoice());
    prisma.payment.findFirst.mockResolvedValue({ id: 'p1' });
    await handler.issue('inv-1', 'p1');
    expect(prisma.payment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { invoiceId: 'inv-1', receiptRecordedBy: { not: null } },
      }),
    );
    expect(renderer.render).not.toHaveBeenCalled();
    expect(storage.uploadFile).not.toHaveBeenCalled();
    expect(prisma.invoice.updateMany).not.toHaveBeenCalled();
    expect(prisma.outboxEvent.create).not.toHaveBeenCalled();
  });
});
