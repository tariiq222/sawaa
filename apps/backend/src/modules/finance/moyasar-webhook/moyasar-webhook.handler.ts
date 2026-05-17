import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
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
import { MoyasarApiClient, MoyasarPaymentStatus } from '../moyasar-api/moyasar-api.client';

export interface MoyasarWebhookRequest {
  payload: MoyasarWebhookDto;
  rawBody: string;
  signature: string;
}

export interface MoyasarWebhookResult {
  skipped?: boolean;
  /** Why a webhook was dropped-and-acked. Present only when `skipped` is true. */
  reason?: string;
}

/**
 * Processes Moyasar webhook events with PER-TENANT signature verification.
 *
 * Stage order:
 *   1. Parse payload — read invoiceId from metadata.
 *   2. System-context lookup of Invoice → resolves the tenant.
 *   3. System-context lookup of OrganizationPaymentConfig for that tenant.
 *   4. Decrypt the tenant's webhook secret (AAD = organizationId).
 *   5. Verify HMAC signature with the tenant's secret.
 *   6. Idempotency check.
 *   7. Re-fetch the payment from the Moyasar API (authoritative source of truth)
 *      and validate its amount/currency against the invoice (anti-spoof).
 *   8. Mutations under the resolved tenant CLS context.
 *
 * ── Error classification ──────────────────────────────────────────────────
 * Moyasar RETRIES any non-2xx response with backoff. A malformed or
 * maliciously-crafted webhook would otherwise be retried forever.
 *
 *   PERMANENT (drop + 200 ack):   never throws — logs and returns
 *   `{ skipped: true, reason }`. Covers: missing metadata/invoice, missing
 *   payment config, webhook-secret decrypt failure, invalid signature,
 *   amount/currency mismatch, Moyasar 404 (payment does not exist), and a
 *   non-terminal fetched status (a later webhook carries the terminal one).
 *
 *   TRANSIENT (propagate → 5xx):  genuine infrastructure failures (DB errors,
 *   transaction deadlocks, a Moyasar re-fetch failing with a network/5xx
 *   error) propagate so Moyasar retries — a retry can legitimately succeed.
 *
 * Why DB before signature: the tenant secret is per-org, so we cannot verify
 * a signature without first resolving which tenant the payload belongs to.
 * The endpoint is rate-limited (Throttle 120/min) and rejections return the
 * same generic 200 ack to avoid acting as an oracle.
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
    private readonly moyasarApi: MoyasarApiClient,
    @Optional() private readonly appMetrics: AppMetricsService | null = null,
  ) {}

  /**
   * Constant-time HMAC-SHA256 verification of the raw webhook body.
   * Returns `true` when the signature matches, `false` otherwise — never
   * throws, so the caller can drop-and-ack an invalid signature with a 200.
   */
  verifySignature(rawBody: string, signature: string, secret: string): boolean {
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    const signatureBuf = Buffer.from(signature, 'hex');
    if (expectedBuf.length !== signatureBuf.length) {
      return false;
    }
    return timingSafeEqual(expectedBuf, signatureBuf);
  }

  async execute(req: MoyasarWebhookRequest): Promise<MoyasarWebhookResult> {
    // STAGE 1 — parse payload.
    const payload = req.payload;
    const { invoiceId } = payload.metadata ?? {};
    if (!invoiceId) {
      this.logger.warn(`Moyasar webhook missing metadata: ${payload.id}`);
      return { skipped: true, reason: 'missing_metadata' };
    }

    // STAGE 2 — resolve tenant from invoice (system context bypasses Proxy).
    const invoice = await this.cls.run(async () => {
      this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
      return this.prisma.invoice.findFirst({ where: { id: invoiceId } });
    });
    if (!invoice) {
      this.logger.warn(
        `Moyasar webhook references unknown invoice ${invoiceId} (payment ${payload.id})`,
      );
      return { skipped: true, reason: 'invoice_not_found' };
    }

    // STAGE 3 — fetch tenant's payment config (system context).
    const cfg = await this.cls.run(async () => {
      this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
      return this.prisma.organizationPaymentConfig.findFirst();
    });
    if (!cfg) {
      // Permanent: no Moyasar config means this deployment cannot ever verify
      // the webhook. Drop-and-ack so Moyasar stops retrying.
      this.logger.error(
        `Moyasar webhook rejected: no OrganizationPaymentConfig (payment ${payload.id})`,
      );
      return { skipped: true, reason: 'missing_payment_config' };
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
      // Permanent: a corrupt/unreadable secret will never decrypt on retry.
      this.logger.error(
        `Moyasar webhook rejected: failed to decrypt webhook secret for org ${DEFAULT_ORG_ID} ` +
          `(payment ${payload.id}): ${err instanceof Error ? err.message : 'unknown'}`,
      );
      return { skipped: true, reason: 'webhook_secret_decrypt_failed' };
    }

    // STAGE 5 — verify signature with tenant's own secret.
    if (!this.verifySignature(req.rawBody, req.signature, webhookSecret)) {
      // Permanent: a forged/invalid signature will never become valid on retry.
      // Returning 200 stops the retry storm and avoids acting as an oracle.
      // We do NOT process or mutate anything — just log and ack.
      this.logger.warn(
        `Moyasar webhook rejected: invalid signature for payment ${payload.id} (invoice ${invoiceId})`,
      );
      return { skipped: true, reason: 'invalid_signature' };
    }

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
        return { skipped: true, reason: 'duplicate' };
      }
      // A non-P2002 DB error here is transient — let it propagate as a 5xx.
      throw err;
    }

    try {
      // STAGE 7 — re-fetch the AUTHORITATIVE payment from the Moyasar API.
      // A signed webhook only proves the message came from Moyasar; the body
      // could be a stale/replayed (but validly-signed) payload. We trust the
      // re-fetched status/amount/currency, NOT the request body.
      let fetched: { id: string; status: MoyasarPaymentStatus; amount: number; currency: string };
      try {
        fetched = await this.moyasarApi.getPaymentStatus(DEFAULT_ORG_ID, payload.id);
      } catch (err) {
        if (err instanceof NotFoundException) {
          // Permanent: Moyasar says this payment does not exist. Drop-and-ack.
          this.logger.error(
            `Moyasar webhook rejected: payment ${payload.id} not found on re-fetch (invoice ${invoiceId})`,
          );
          await this.markWebhookEvent(webhookEventRowId, 'error');
          return { skipped: true, reason: 'payment_not_found' };
        }
        // Transient: network error / 5xx / timeout — propagate so Moyasar retries.
        throw err;
      }

      // Verify the re-fetched payment matches the invoice it claims to pay.
      // invoice.total is already in halalas; Moyasar amount is in halalas.
      const expectedHalalas = Math.round(Number(invoice.total));
      if (fetched.amount !== expectedHalalas) {
        // Permanent: a spoofed/mismatched amount will never match on retry.
        this.logger.error(
          `Moyasar webhook rejected: amount mismatch for invoice ${invoice.id} ` +
            `(expected=${expectedHalalas} fetched=${fetched.amount} payment=${payload.id})`,
        );
        await this.markWebhookEvent(webhookEventRowId, 'error');
        return { skipped: true, reason: 'amount_mismatch' };
      }
      if (fetched.currency.toUpperCase() !== invoice.currency.toUpperCase()) {
        // Permanent: currency mismatch will never match on retry.
        this.logger.error(
          `Moyasar webhook rejected: currency mismatch for invoice ${invoice.id} ` +
            `(expected=${invoice.currency} fetched=${fetched.currency} payment=${payload.id})`,
        );
        await this.markWebhookEvent(webhookEventRowId, 'error');
        return { skipped: true, reason: 'currency_mismatch' };
      }

      // Map the AUTHORITATIVE Moyasar status to the internal PaymentStatus.
      //   paid / captured  → COMPLETED
      //   failed / voided  → FAILED
      //   anything else (authorized, initiated, pending-like) → not terminal
      const status = this.toTerminalStatus(fetched.status);
      if (status === null) {
        // Permanent for THIS delivery: the payment is not in a terminal state
        // yet. A later webhook will carry the terminal status — ack this one.
        this.logger.log(
          `Moyasar webhook: payment ${payload.id} not yet terminal ` +
            `(status=${fetched.status}, invoice ${invoice.id}) — skipping`,
        );
        await this.markWebhookEvent(webhookEventRowId, 'processed');
        return { skipped: true, reason: `non_terminal_status:${fetched.status}` };
      }

      // STAGE 8 — run mutations inside the resolved tenant's CLS context.
      // Payment.amount is stored in halalas — fetched.amount is already halalas.
      const amountHalalas = fetched.amount;
      const result = await this.cls.run(async () => {
        this.cls.set(TENANT_CLS_KEY, {
          organizationId: DEFAULT_ORG_ID,
          id: 'system',
          role: 'system',
          isSuperAdmin: false,
        });

        // Guard: never overwrite a terminal (REFUNDED) payment back to COMPLETED/FAILED.
        const existingPayment = await this.prisma.payment.findUnique({
          where: { idempotencyKey: `moyasar:${payload.id}` },
          select: { status: true },
        });
        if (existingPayment?.status === PaymentStatus.REFUNDED) {
          this.logger.warn(
            `Webhook: skipping update for REFUNDED payment (gatewayRef=${payload.id})`,
          );
          return { skipped: true, reason: 'already_refunded' } as MoyasarWebhookResult;
        }

        // Wrap payment upsert + invoice update in a single transaction to ensure
        // atomicity — if either fails, both roll back and no inconsistent state is stored.
        const paymentId = await this.rlsTransaction.withTransaction(async (tx) => {
          const payment = await tx.payment.upsert({
            where: { idempotencyKey: `moyasar:${payload.id}` },
            update: { status, processedAt: new Date(), failureReason: payload.message },
            create: {
              invoiceId,
              amount: amountHalalas,
              currency: fetched.currency,
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
            amount: amountHalalas,
            currency: invoice.currency,
          });
          await this.eventBus.publish(event.eventName, event.toEnvelope());
        } else if (status === PaymentStatus.FAILED) {
          this.appMetrics?.paymentAttempts.labels({ result: 'failed' }).inc();
          const failedEvent = new PaymentFailedEvent({
            paymentId,
            invoiceId: invoice.id,
            clientId: invoice.clientId,
            amount: amountHalalas,
            currency: invoice.currency,
            reason: payload.message,
          });
          await this.eventBus.publish(failedEvent.eventName, failedEvent.toEnvelope());
        }

        return {} as MoyasarWebhookResult;
      });

      await this.markWebhookEvent(webhookEventRowId, 'processed');

      return result;
    } catch (err) {
      // Genuine infrastructure failure — mark the event row and re-throw so the
      // controller responds 5xx and Moyasar retries (a retry may succeed).
      await this.markWebhookEvent(webhookEventRowId, 'error');
      throw err;
    }
  }

  /**
   * Maps an authoritative Moyasar status to the internal terminal PaymentStatus.
   * Returns `null` when the payment is not yet in a terminal state — the caller
   * should ack without mutating and wait for a later webhook.
   */
  private toTerminalStatus(status: MoyasarPaymentStatus): PaymentStatus | null {
    switch (status) {
      case 'paid':
      case 'captured':
        return PaymentStatus.COMPLETED;
      case 'failed':
      case 'voided':
        return PaymentStatus.FAILED;
      default:
        // authorized, initiated, refunded (handled by the REFUNDED guard), …
        return null;
    }
  }

  private async markWebhookEvent(
    webhookEventRowId: string,
    result: 'processed' | 'error',
  ): Promise<void> {
    await this.prisma.webhookEvent
      .update({
        where: { id: webhookEventRowId },
        data: { processedAt: new Date(), result },
      })
      .catch((updateErr) => {
        this.logger.error(
          `Failed to mark webhook event as ${result} (${webhookEventRowId}): ${String(updateErr)}`,
        );
      });
  }
}
