import { Injectable, BadRequestException, Logger, Optional } from '@nestjs/common';
import { createHmac, createHash, timingSafeEqual } from 'crypto';
import { Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { MoyasarCredentialsService } from '../../../infrastructure/payments/moyasar-credentials.service';
import { SYSTEM_CONTEXT_CLS_KEY, TENANT_CLS_KEY } from '../../../common/constants';
import { PaymentCompletedEvent } from '../events/payment-completed.event';
import { PaymentFailedEvent } from '../events/payment-failed.event';
import { MoyasarWebhookDto } from './moyasar-webhook.dto';
import { AppMetricsService } from '../../../infrastructure/telemetry/app-metrics.service';
import { DEFAULT_ORG_ID } from '../../../common/constants';

export interface MoyasarWebhookRequest {
  payload: MoyasarWebhookDto;
  rawBody: string;
  signature: string;
}

/**
 * Processes Moyasar webhook events with PER-TENANT signature verification.
 *
 * Stage order (changed 2026-05-05):
 *   1. Parse payload — read invoiceId from metadata.
 *   2. System-context lookup of Invoice → resolves the tenant.
 *   3. System-context lookup of OrganizationPaymentConfig for that tenant.
 *   4. Decrypt the tenant's webhook secret (AAD = organizationId).
 *   5. Verify HMAC signature with the tenant's secret.
 *   6. Idempotency check.
 *   7. Validate payload amount + currency match the invoice (anti-spoof).
 *   8. Mutations under the resolved tenant CLS context.
 *
 * Why DB before signature: the tenant secret is per-org, so we cannot verify
 * a signature without first resolving which tenant the payload belongs to.
 * The endpoint is rate-limited (Throttle 120/min) and lookup failures return
 * the same generic responses to avoid acting as an oracle.
 */
@Injectable()
export class MoyasarWebhookHandler {
  private readonly logger = new Logger(MoyasarWebhookHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly eventBus: EventBusService,
    private readonly cls: ClsService,
    private readonly creds: MoyasarCredentialsService,
    @Optional() private readonly appMetrics: AppMetricsService | null = null,
  ) {}

  verifySignature(rawBody: string, signature: string, secret: string): void {
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    const signatureBuf = Buffer.from(signature, 'hex');
    if (
      expectedBuf.length !== signatureBuf.length ||
      !timingSafeEqual(expectedBuf, signatureBuf)
    ) {
      throw new BadRequestException('Invalid Moyasar webhook signature');
    }
  }

  async execute(req: MoyasarWebhookRequest): Promise<{ skipped?: boolean }> {
    // STAGE 1 — parse payload.
    const payload = req.payload;
    const { invoiceId } = payload.metadata ?? {};
    if (!invoiceId) {
      this.logger.warn(`Moyasar webhook missing metadata: ${payload.id}`);
      return { skipped: true };
    }

    // STAGE 2 — resolve tenant from invoice (system context bypasses Proxy).
    const invoice = await this.cls.run(async () => {
      this.logger.warn('systemContext bypass activated', { context: 'MoyasarWebhookHandler' });
      this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
      return this.prisma.invoice.findFirst({ where: { id: invoiceId } });
    });
    if (!invoice) return { skipped: true };

    // STAGE 3 — fetch tenant's payment config (system context).
    const cfg = await this.cls.run(async () => {
      this.logger.warn('systemContext bypass activated', { context: 'MoyasarWebhookHandler' });
      this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
      return this.prisma.organizationPaymentConfig.findFirst();
    });
    if (!cfg) {
      throw new BadRequestException('Invalid webhook request');
    }

    // STAGE 4 — decrypt the tenant's webhook secret (AAD = organizationId).
    let webhookSecret: string;
    try {
      const decoded = this.creds.decrypt<{ webhookSecret: string }>(
        cfg.webhookSecretEnc,
        DEFAULT_ORG_ID,
      );
      webhookSecret = decoded.webhookSecret;
    } catch (err) {
      this.logger.error(
        `Failed to decrypt webhook secret for org ${DEFAULT_ORG_ID}: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      throw new BadRequestException('Invalid webhook request');
    }

    // STAGE 5 — verify signature with tenant's own secret.
    this.verifySignature(req.rawBody, req.signature, webhookSecret);

    // STAGE 6 — idempotency dedup via WebhookEvent (covers ALL statuses, not
    // just COMPLETED). Moyasar retries failed-payment webhooks — without this
    // guard every retry would re-emit PaymentFailedEvent and re-run mutations.
    // We use the optimistic-insert pattern (create → catch P2002) so the dedup
    // is atomic under concurrent retries.  WebhookEvent is a platform-level
    // table (no tenant scope), so plain this.prisma.webhookEvent works without
    // a CLS bypass.
    const webhookEventId = `${payload.id}:${payload.status}`;
    const payloadHash = createHash('sha256').update(req.rawBody).digest('hex');

    let webhookEventRowId: string;
    try {
      const created = await this.prisma.webhookEvent.create({
        data: {
          provider: 'MOYASAR_TENANT',
          eventId: webhookEventId,
          eventType: payload.status,
          payloadHash,
        },
        select: { id: true },
      });
      webhookEventRowId = created.id;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        this.logger.log(
          `Tenant webhook: skipped_duplicate provider=MOYASAR_TENANT eventId=${webhookEventId}`,
        );
        return { skipped: true };
      }
      throw err;
    }

    try {
      // STAGE 7 — verify webhook payload matches the invoice it claims to pay.
      // Without this check, a 1 SAR Moyasar payment with metadata.invoiceId pointing
      // at a 1000 SAR invoice would mark the larger invoice PAID.
      const expectedHalalas = Math.round(Number(invoice.total) * 100);
      if (payload.amount !== expectedHalalas) {
        this.logger.error(
          `Webhook amount mismatch for invoice ${invoice.id}: expected=${expectedHalalas} got=${payload.amount}`,
        );
        throw new BadRequestException('Payment amount does not match invoice total');
      }
      if (payload.currency.toUpperCase() !== invoice.currency.toUpperCase()) {
        this.logger.error(
          `Webhook currency mismatch for invoice ${invoice.id}: expected=${invoice.currency} got=${payload.currency}`,
        );
        throw new BadRequestException('Payment currency does not match invoice');
      }

      // STAGE 8 — run mutations inside the resolved tenant's CLS context.
      const result = await this.cls.run(async () => {
        this.cls.set(TENANT_CLS_KEY, {
          organizationId: DEFAULT_ORG_ID,
          id: 'system',
          role: 'system',
          isSuperAdmin: false,
        });

        const amountSar = payload.amount / 100;
        const status: PaymentStatus =
          payload.status === 'paid' ? PaymentStatus.COMPLETED : PaymentStatus.FAILED;

        // Guard: never overwrite a terminal (REFUNDED) payment back to COMPLETED/FAILED.
        const existingPayment = await this.prisma.payment.findUnique({
          where: { idempotencyKey: `moyasar:${payload.id}` },
          select: { status: true },
        });
        if (existingPayment?.status === PaymentStatus.REFUNDED) {
          this.logger.warn(
            `Webhook: skipping update for REFUNDED payment (gatewayRef=${payload.id})`,
          );
          return {};
        }

        // Wrap payment upsert + invoice update in a single transaction to ensure
        // atomicity — if either fails, both roll back and no inconsistent state is stored.
        const paymentId = await this.rlsTransaction.withTransaction(async (tx) => {
          const payment = await tx.payment.upsert({
            where: { idempotencyKey: `moyasar:${payload.id}` },
            update: { status, processedAt: new Date(), failureReason: payload.message },
            create: {
              invoiceId,
              amount: amountSar,
              currency: payload.currency,
              method: PaymentMethod.ONLINE_CARD,
              status,
              gatewayRef: payload.id,
              idempotencyKey: `moyasar:${payload.id}`,
              processedAt: status === PaymentStatus.COMPLETED ? new Date() : undefined,
              failureReason: payload.message,
            },
          });

          if (status === PaymentStatus.COMPLETED) {
            await tx.invoice.update({
              where: { id: invoiceId },
              data: { status: 'PAID', paidAt: new Date() },
            });
          }

          return payment.id;
        });

        // Event emission is intentionally OUTSIDE the transaction:
        // - The payment and invoice are durably committed.
        // - If eventBus.publish fails, BullMQ will retry (at-least-once semantics).
        // - Consumers (e.g. booking confirmation) are idempotent.
        if (status === PaymentStatus.COMPLETED) {
          this.appMetrics?.paymentAttempts.labels({ result: 'succeeded' }).inc();
          const event = new PaymentCompletedEvent({
            paymentId,
            invoiceId: invoice.id,
            bookingId: invoice.bookingId,
            amount: amountSar,
            currency: invoice.currency,
          });
          await this.eventBus.publish(event.eventName, event.toEnvelope());
        } else if (status === PaymentStatus.FAILED) {
          this.appMetrics?.paymentAttempts.labels({ result: 'failed' }).inc();
          const failedEvent = new PaymentFailedEvent({
            paymentId,
            invoiceId: invoice.id,
            clientId: invoice.clientId,
            amount: amountSar,
            currency: invoice.currency,
            reason: payload.message,
          });
          await this.eventBus.publish(failedEvent.eventName, failedEvent.toEnvelope());
        }

        return {};
      });

      await this.prisma.webhookEvent.update({
        where: { id: webhookEventRowId },
        data: { processedAt: new Date(), result: 'processed' },
      });

      return result;
    } catch (err) {
      await this.prisma.webhookEvent
        .update({
          where: { id: webhookEventRowId },
          data: { processedAt: new Date(), result: 'error' },
        })
        .catch((updateErr) => {
          this.logger.error(
            `Failed to mark webhook event as error (${webhookEventRowId}): ${String(updateErr)}`,
          );
        });
      throw err;
    }
  }
}
