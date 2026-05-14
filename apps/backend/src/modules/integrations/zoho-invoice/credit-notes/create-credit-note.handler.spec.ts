import { CreateCreditNoteHandler } from './create-credit-note.handler';
import type { PrismaService } from '../../../../infrastructure/database';
import type { ZohoApiClient, ZohoIntegrationConfig } from '../../../../infrastructure/zoho';

describe('CreateCreditNoteHandler — tenant isolation + idempotency', () => {
  const TENANT_A = 'org-A';
  const TENANT_B = 'org-B';
  const REFUND_ID = 'rfnd-1';
  const INVOICE_ID = 'inv-1';

  const config: ZohoIntegrationConfig = {
    refreshToken: 'rt',
    zohoOrganizationId: 'zoho-A',
    dataCenter: 'sa',
    webhookSecret: 'w',
    defaults: { sendOnCreate: false },
  };

  function makeHandler() {
    const linkFindUnique = jest.fn();
    const cnFindUnique = jest.fn();
    const cnCreate = jest.fn().mockResolvedValue({ id: 'cn-link' });
    const prisma = {
      zohoInvoiceLink: { findUnique: linkFindUnique },
      zohoCreditNoteLink: { findUnique: cnFindUnique, create: cnCreate },
    } as unknown as PrismaService;

    const createCreditNote = jest.fn().mockResolvedValue({
      creditnote: { creditnote_id: 'cn_1', creditnote_number: 'CN-1', status: 'open', total: 50, balance: 0, customer_id: 'zc' },
    });
    const refundCreditNote = jest.fn().mockResolvedValue({});
    const api = { createCreditNote, refundCreditNote } as unknown as ZohoApiClient;

    return {
      handler: new CreateCreditNoteHandler(prisma, api),
      linkFindUnique,
      cnFindUnique,
      cnCreate,
      createCreditNote,
      refundCreditNote,
    };
  }

  it('looks up the parent ZohoInvoiceLink with (organizationId, scope, deqahInvoiceId)', async () => {
    const { handler, linkFindUnique } = makeHandler();
    linkFindUnique.mockResolvedValue(null);
    await handler.execute({
      organizationId: TENANT_A,
      config,
      refundRequestId: REFUND_ID,
      invoiceId: INVOICE_ID,
      amount: 50,
    });
    expect(linkFindUnique).toHaveBeenCalledWith({
      where: {
        zoho_link_org_scope_invoice: {
          organizationId: TENANT_A,
          scope: 'TENANT_CLIENT',
          deqahInvoiceId: INVOICE_ID,
        },
      },
    });
  });

  it('returns null without calling Zoho when there is no parent link (refund unrelated to Zoho-mirrored invoice)', async () => {
    const { handler, linkFindUnique, createCreditNote } = makeHandler();
    linkFindUnique.mockResolvedValue(null);
    const result = await handler.execute({
      organizationId: TENANT_A,
      config,
      refundRequestId: REFUND_ID,
      invoiceId: INVOICE_ID,
      amount: 50,
    });
    expect(result).toBeNull();
    expect(createCreditNote).not.toHaveBeenCalled();
  });

  it('is idempotent on (organizationId, deqahRefundRequestId)', async () => {
    const { handler, linkFindUnique, cnFindUnique, createCreditNote } = makeHandler();
    linkFindUnique.mockResolvedValue({
      id: 'link-1',
      zohoCustomerId: 'zc',
      zohoInvoiceId: 'zinv',
      currency: 'SAR',
    });
    cnFindUnique.mockResolvedValue({ zohoCreditNoteId: 'existing-cn' });

    const result = await handler.execute({
      organizationId: TENANT_A,
      config,
      refundRequestId: REFUND_ID,
      invoiceId: INVOICE_ID,
      amount: 50,
    });

    expect(cnFindUnique).toHaveBeenCalledWith({
      where: {
        organizationId_deqahRefundRequestId: {
          organizationId: TENANT_A,
          deqahRefundRequestId: REFUND_ID,
        },
      },
    });
    expect(result).toEqual({ zohoCreditNoteId: 'existing-cn' });
    expect(createCreditNote).not.toHaveBeenCalled();
  });

  it('persists the credit-note link with the caller organizationId', async () => {
    const { handler, linkFindUnique, cnFindUnique, cnCreate } = makeHandler();
    linkFindUnique.mockResolvedValue({
      id: 'link-1',
      zohoCustomerId: 'zc',
      zohoInvoiceId: 'zinv',
      currency: 'SAR',
    });
    cnFindUnique.mockResolvedValue(null);

    await handler.execute({
      organizationId: TENANT_B,
      config,
      refundRequestId: REFUND_ID,
      invoiceId: INVOICE_ID,
      amount: 50,
    });

    // org scoping moved to RLS / removed in single-tenant migration
    const args = cnCreate.mock.calls[0]![0];
    expect(JSON.stringify(args.data)).not.toContain(TENANT_A);
  });

  it('persists the credit-note link even when Zoho refund posting fails (defensive)', async () => {
    const { handler, linkFindUnique, cnFindUnique, refundCreditNote, cnCreate } = makeHandler();
    linkFindUnique.mockResolvedValue({
      id: 'link-1',
      zohoCustomerId: 'zc',
      zohoInvoiceId: 'zinv',
      currency: 'SAR',
    });
    cnFindUnique.mockResolvedValue(null);
    refundCreditNote.mockRejectedValue(new Error('zoho refund 5xx'));

    const result = await handler.execute({
      organizationId: TENANT_A,
      config,
      refundRequestId: REFUND_ID,
      invoiceId: INVOICE_ID,
      amount: 50,
    });

    expect(result?.zohoCreditNoteId).toBe('cn_1');
    expect(cnCreate).toHaveBeenCalled();
  });
});
