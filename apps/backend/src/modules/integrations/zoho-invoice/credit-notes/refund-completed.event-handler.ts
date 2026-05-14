import { Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { EventBusService } from '../../../../infrastructure/events';
import { PrismaService } from '../../../../infrastructure/database';
import { ZohoConfigService } from '../zoho-config.service';
import { CreateCreditNoteHandler } from './create-credit-note.handler';
import { TENANT_CLS_KEY } from '../../../../common/tenant/tenant.constants';

interface RefundCompletedPayload {
  refundRequestId: string;
  organizationId: string;
  invoiceId: string;
  paymentId: string;
  bookingId: string;
  amount: number;
  currency: string;
}

/**
 * Subscribes to `finance.refund.completed` and mirrors a credit-note +
 * refund posting into the tenant's Zoho organization.
 */
@Injectable()
export class RefundCompletedEventHandler {
  private readonly logger = new Logger(RefundCompletedEventHandler.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly config: ZohoConfigService,
    private readonly createCreditNote: CreateCreditNoteHandler,
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  register(): void {
    this.eventBus.subscribe<RefundCompletedPayload>(
      'finance.refund.completed',
      async (envelope) => {
        const { organizationId, invoiceId, refundRequestId, amount, paymentId } =
          envelope.payload;

        const status = await this.config.load(organizationId);
        if (!status.isConfigured || !status.isActive || !status.config) {
          return;
        }

        await this.cls.run(async () => {
          this.cls.set(TENANT_CLS_KEY, {
            organizationId,
            id: 'system',
            role: 'system',
            isSuperAdmin: false,
          });

          const refund = await this.prisma.refundRequest.findFirst({
            where: { id: refundRequestId, organizationId },
            select: { reason: true },
          });
          const payment = await this.prisma.payment.findFirst({
            where: { id: paymentId, organizationId },
            select: { gatewayRef: true },
          });

          try {
            await this.createCreditNote.execute({
              organizationId,
              config: status.config!,
              refundRequestId,
              invoiceId,
              amount,
              reason: refund?.reason ?? undefined,
              gatewayRef: payment?.gatewayRef ?? undefined,
            });
          } catch (err) {
            this.logger.error(
              `Failed to mirror refund ${refundRequestId} to Zoho: ${(err as Error).message}`,
            );
            throw err;
          }
        });
      },
    );
  }
}
