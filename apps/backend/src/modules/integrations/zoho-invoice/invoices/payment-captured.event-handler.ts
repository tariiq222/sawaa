import { Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { EventBusService } from '../../../../infrastructure/events';
import { ZohoConfigService } from '../zoho-config.service';
import { CreateZohoInvoiceHandler } from './create-invoice.handler';
import { TENANT_CLS_KEY } from '../../../../common/tenant/tenant.constants';

interface PaymentCompletedPayload {
  paymentId: string;
  invoiceId: string;
  bookingId: string;
  amount: number;
  currency: string;
  organizationId?: string;
}

/**
 * Subscribes to `finance.payment.completed` and mirrors the resulting
 * paid invoice into the tenant's Zoho organization.
 *
 * - No-op when:
 *   • payload has no organizationId (legacy producers — covered by reconcile cron in a future iteration);
 *   • the tenant has not configured Zoho;
 *   • the integration is currently disabled.
 *
 * Errors propagate so BullMQ retries (at-least-once). The CreateZohoInvoiceHandler
 * is idempotent, so retries cannot duplicate the Zoho invoice.
 */
@Injectable()
export class PaymentCapturedEventHandler {
  private readonly logger = new Logger(PaymentCapturedEventHandler.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly config: ZohoConfigService,
    private readonly createInvoice: CreateZohoInvoiceHandler,
    private readonly cls: ClsService,
  ) {}

  register(): void {
    this.eventBus.subscribe<PaymentCompletedPayload>(
      'finance.payment.completed',
      async (envelope) => {
        const { organizationId, invoiceId, paymentId } = envelope.payload;
        if (!organizationId) {
          this.logger.debug('payment.completed without organizationId — skipping Zoho mirror');
          return;
        }

        const status = await this.config.load(organizationId);
        if (!status.isConfigured || !status.isActive || !status.config) {
          return;
        }

        // BullMQ workers run outside the HTTP request CLS, so any Prisma
        // call would fail tenant scoping. Run inside cls.run with the
        // resolved tenant context so the `Client` lookup in
        // UpsertContactHandler succeeds.
        await this.cls.run(async () => {
            this.cls.set(TENANT_CLS_KEY, {
              organizationId,
              id: 'system',
              role: 'system',
              isSuperAdmin: false,
            });
          try {
            await this.createInvoice.execute({
              organizationId,
              invoiceId,
              paymentId,
              config: status.config!,
            });
          } catch (err) {
            this.logger.error(
              `Failed to mirror invoice ${invoiceId} (org ${organizationId}) to Zoho: ${(err as Error).message}`,
            );
            throw err;
          }
        });
      },
    );
  }
}
