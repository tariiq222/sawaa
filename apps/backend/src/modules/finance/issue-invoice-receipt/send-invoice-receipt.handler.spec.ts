import { SendInvoiceReceiptHandler } from './send-invoice-receipt.handler';

describe('SendInvoiceReceiptHandler', () => {
  let handler: SendInvoiceReceiptHandler;
  let prisma: any;
  let emailFactory: any;
  let emailProvider: any;

  beforeEach(() => {
    emailProvider = { sendMail: jest.fn().mockResolvedValue({ messageId: 'm1' }) };
    emailFactory = { resolve: jest.fn().mockResolvedValue(emailProvider) };
    prisma = {
      client: { findUnique: jest.fn().mockResolvedValue({ email: 'f@example.com', firstName: 'فاطمة' }) },
      invoice: { update: jest.fn() },
    };
    handler = new SendInvoiceReceiptHandler(prisma, emailFactory, { run: (fn: any) => fn(), set: jest.fn() } as any);
  });

  it('skips when client has no email', async () => {
    prisma.client.findUnique.mockResolvedValue({ email: null, firstName: 'X' });
    await handler.handle({ payload: { invoiceId: 'inv-1', clientId: 'c1', pdfUrl: 'u', invoiceNumber: 1, organizationId: 'o' } } as any);
    expect(emailProvider.sendMail).not.toHaveBeenCalled();
  });

  it('sends email with PDF link and marks sentToClientAt', async () => {
    await handler.handle({ payload: { invoiceId: 'inv-1', clientId: 'c1', pdfUrl: 'http://pdf', invoiceNumber: 42, organizationId: 'o' } } as any);
    expect(emailProvider.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'f@example.com',
      subject: expect.stringContaining('42'),
      html: expect.stringContaining('http://pdf'),
    }));
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: { sentToClientAt: expect.any(Date) },
    });
  });
});
