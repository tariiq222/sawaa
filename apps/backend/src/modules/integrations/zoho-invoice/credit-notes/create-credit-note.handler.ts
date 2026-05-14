import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';
import {
  ZohoApiClient,
  type ZohoIntegrationConfig,
} from '../../../../infrastructure/zoho';

/**
 * Creates a Zoho credit-note + refund pair to mirror a Sawaa refund.
 *
 * Idempotent through `ZohoCreditNoteLink (organizationId, deqahRefundRequestId)`.
 */
@Injectable()
export class CreateCreditNoteHandler {
  private readonly logger = new Logger(CreateCreditNoteHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly api: ZohoApiClient,
  ) {}

  async execute(input: {
    organizationId: string;
    config: ZohoIntegrationConfig;
    refundRequestId: string;
    invoiceId: string;
    amount: number;
    reason?: string;
    gatewayRef?: string;
  }): Promise<{ zohoCreditNoteId: string } | null> {
    const link = await this.prisma.zohoInvoiceLink.findUnique({
      where: {
        zoho_link_org_scope_invoice: {
          organizationId: input.organizationId,
          scope: 'TENANT_CLIENT',
          deqahInvoiceId: input.invoiceId,
        },
      },
    });
    if (!link) {
      this.logger.warn(
        `Refund ${input.refundRequestId}: no ZohoInvoiceLink for invoice ${input.invoiceId} — nothing to credit.`,
      );
      return null;
    }

    const dedup = await this.prisma.zohoCreditNoteLink.findUnique({
      where: {
        organizationId_deqahRefundRequestId: {
          organizationId: input.organizationId,
          deqahRefundRequestId: input.refundRequestId,
        },
      },
    });
    if (dedup) return { zohoCreditNoteId: dedup.zohoCreditNoteId };

    const apiCtx = {
      organizationId: input.organizationId,
      zohoOrganizationId: input.config.zohoOrganizationId,
      refreshToken: input.config.refreshToken,
      dataCenter: input.config.dataCenter,
    };

    const today = new Date().toISOString().slice(0, 10);

    const cn = await this.api.createCreditNote(apiCtx, {
      customer_id: link.zohoCustomerId,
      reference_invoice_id: link.zohoInvoiceId,
      date: today,
      reason: input.reason ?? `Sawaa refund ${input.refundRequestId}`,
      line_items: [
        {
          name: 'Refund',
          description: `Sawaa refund ${input.refundRequestId}`,
          rate: input.amount,
          quantity: 1,
        },
      ],
    });

    // Apply the credit-note as a refund (cash-out, since the original
    // payment was via Moyasar and money has already left).
    try {
      await this.api.refundCreditNote(apiCtx, cn.creditnote.creditnote_id, {
        date: today,
        amount: input.amount,
        refund_mode: 'creditcard',
        reference_number: input.gatewayRef ?? input.refundRequestId,
        description: `Moyasar refund ${input.gatewayRef ?? input.refundRequestId}`,
      });
    } catch (err) {
      // The credit-note exists in Zoho even if refund posting fails — log
      // and persist the link so a retry doesn't duplicate the credit-note.
      this.logger.warn(
        `Zoho refund posting failed for credit-note ${cn.creditnote.creditnote_id}: ${(err as Error).message}`,
      );
    }

    await this.prisma.zohoCreditNoteLink.create({
      data: {
        zohoInvoiceLinkId: link.id,
        deqahRefundRequestId: input.refundRequestId,
        zohoCreditNoteId: cn.creditnote.creditnote_id,
        amount: input.amount,
        currency: link.currency,
        status: cn.creditnote.status,
      },
    });

    return { zohoCreditNoteId: cn.creditnote.creditnote_id };
  }
}
