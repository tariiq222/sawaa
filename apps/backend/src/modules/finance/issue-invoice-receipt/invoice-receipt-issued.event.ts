import { BaseEvent } from '../../../common/events';

export interface InvoiceReceiptIssuedPayload {
  invoiceId: string;
  invoiceNumber: number;
  clientId: string;
  pdfUrl: string;
  organizationId: string;
}

/**
 * Emitted after a PDF receipt has been rendered and uploaded for an Invoice
 * in PAID status. Subscribers (email/SMS/push) consume this to deliver the
 * receipt to the client. Idempotent — never emitted twice for the same invoice.
 */
export class InvoiceReceiptIssuedEvent extends BaseEvent<InvoiceReceiptIssuedPayload> {
  readonly eventName = 'finance.invoice.receipt.issued';

  constructor(payload: InvoiceReceiptIssuedPayload) {
    super({ source: 'finance', version: 1, payload });
  }
}
