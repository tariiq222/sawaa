import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';
import {
  ZohoApiClient,
  type ZohoIntegrationConfig,
} from '../../../../infrastructure/zoho';

const PAYMENT_MODE_MAP: Record<string, string> = {
  ONLINE_CARD: 'creditcard',
  BANK_TRANSFER: 'banktransfer',
  CASH: 'cash',
  COUPON: 'cash', // Coupon-only invoices have a 0 amount, but Zoho still wants a mode.
};

/**
 * Records a Moyasar capture as a Zoho `customerpayment` against an existing
 * Zoho invoice. Idempotent through the unique constraint on the linked
 * Payment.gatewayRef → reference_number passed to Zoho.
 *
 * The Sawaa `Payment` row is the source of truth for amount + mode; we
 * read it once and forward to Zoho. We never mutate Sawaa's payment state
 * here — that's already done by the time this handler runs.
 */
@Injectable()
export class RecordPaymentHandler {
  private readonly logger = new Logger(RecordPaymentHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly api: ZohoApiClient,
  ) {}

  async execute(input: {
    organizationId: string;
    config: ZohoIntegrationConfig;
    zohoInvoiceId: string;
    zohoCustomerId: string;
    paymentId: string;
  }): Promise<void> {
    const payment = await this.prisma.payment.findFirstOrThrow({
      where: { id: input.paymentId, organizationId: input.organizationId },
      select: {
        id: true,
        amount: true,
        method: true,
        gatewayRef: true,
        processedAt: true,
        createdAt: true,
      },
    });

    const date = (payment.processedAt ?? payment.createdAt).toISOString().slice(0, 10);
    const reference = payment.gatewayRef ?? payment.id;

    await this.api.recordCustomerPayment(
      {
        organizationId: input.organizationId,
        zohoOrganizationId: input.config.zohoOrganizationId,
        refreshToken: input.config.refreshToken,
        dataCenter: input.config.dataCenter,
      },
      {
        customer_id: input.zohoCustomerId,
        payment_mode: PAYMENT_MODE_MAP[payment.method] ?? 'creditcard',
        amount: Number(payment.amount),
        date,
        reference_number: reference,
        description: `Moyasar capture ${reference}`,
        invoices: [
          { invoice_id: input.zohoInvoiceId, amount_applied: Number(payment.amount) },
        ],
      },
    );
  }
}
