import { SendInvoiceReceiptHandler } from './send-invoice-receipt.handler';

describe('SendInvoiceReceiptHandler', () => {
  let handler: SendInvoiceReceiptHandler;
  let prisma: any;
  let emailFactory: any;
  let emailProvider: any;
  let storage: any;

  beforeEach(() => {
    emailProvider = { sendMail: jest.fn().mockResolvedValue({ messageId: 'm1' }) };
    emailFactory = { resolve: jest.fn().mockResolvedValue(emailProvider) };
    prisma = {
      client: { findUnique: jest.fn().mockResolvedValue({ email: 'f@example.com', firstName: 'فاطمة' }) },
      invoice: { update: jest.fn() },
    };
    storage = {
      getSignedUrl: jest.fn().mockResolvedValue('https://minio/presigned-7d'),
    };
    handler = new SendInvoiceReceiptHandler(
      prisma,
      emailFactory,
      storage,
      { run: (fn: any) => fn(), set: jest.fn() } as any,
    );
  });

  it('skips when client has no email', async () => {
    prisma.client.findUnique.mockResolvedValue({ email: null, firstName: 'X' });
    await handler.handle({ payload: { invoiceId: 'inv-1', clientId: 'c1', pdfUrl: 'u', invoiceNumber: 1, organizationId: 'o' } } as any);
    expect(emailProvider.sendMail).not.toHaveBeenCalled();
  });

  it('presigns the stored key (7d) and embeds the presigned link, then marks sentToClientAt', async () => {
    await handler.handle({
      payload: {
        invoiceId: 'inv-1',
        clientId: 'c1',
        pdfUrl: 'invoices/inv-1/1700000000000.pdf',
        invoiceNumber: 42,
        organizationId: 'o',
      },
    } as any);

    // S2.3a: a 7-day presigned URL is minted from the stored object key.
    expect(storage.getSignedUrl).toHaveBeenCalledWith(
      'finance-invoices',
      'invoices/inv-1/1700000000000.pdf',
      604800,
    );
    expect(emailProvider.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'f@example.com',
      subject: expect.stringContaining('42'),
      html: expect.stringContaining('https://minio/presigned-7d'),
    }));
    // The raw stored key must never appear directly in the email body.
    const sentHtml = emailProvider.sendMail.mock.calls[0][0].html;
    expect(sentHtml).not.toContain('invoices/inv-1/1700000000000.pdf');
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: { sentToClientAt: expect.any(Date) },
    });
  });

  it('normalises a legacy full URL back to the object key before presigning', async () => {
    await handler.handle({
      payload: {
        invoiceId: 'inv-1',
        clientId: 'c1',
        pdfUrl: 'http://localhost:9000/finance-invoices/invoices/inv-1/42.pdf',
        invoiceNumber: 7,
        organizationId: 'o',
      },
    } as any);
    expect(storage.getSignedUrl).toHaveBeenCalledWith(
      'finance-invoices',
      'invoices/inv-1/42.pdf',
      604800,
    );
  });
});
