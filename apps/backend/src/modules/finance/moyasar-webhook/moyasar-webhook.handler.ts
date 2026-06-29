import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { createHmac, createHash, timingSafeEqual } from 'crypto';
import { Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { MoyasarCredentialsService } from '../../../infrastructure/payments/moyasar-credentials.service';
import { DEFAULT_ORG_ID, PAYMENT_CONFIG_SINGLETON_KEY, SINGLE_TENANT_CONTEXT_ID, SYSTEM_CONTEXT_CLS_KEY, TENANT_CLS_KEY } from '../../../common/constants';
import { errorMessage } from '../../../common/helpers/error-message.helper';
import { PaymentCompletedEvent } from '../events/payment-completed.event';
import { PaymentFailedEvent } from '../events/payment-failed.event';
import { DepositPaidEvent } from '../events/deposit-paid.event';
import { resolveInvoiceDeposit, isDepositPayment } from '../deposit.helper';
import { MoyasarWebhookDto } from './moyasar-webhook.dto';
import { AppMetricsService } from '../../../infrastructure/telemetry/app-metrics.service';
import { MoyasarApiClient, MoyasarPaymentStatus } from '../moyasar-api/moyasar-api.client';
import { assertValidTransition } from '../payment-state-machine';

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
 * Processes Moyasar webhook events with deployment-level signature verification.
 *
 * Moyasar delivers webhooks in a NESTED shape — an event envelope at the root
 * ({ id, type, secret_token }) wrapping the payment object under `data`. Some
 * merchant configs / legacy callers send a FLAT shape with the payment fields
 * at the root. Stage 1 normalizes both into one internal object.
 *
 * Stage order:
 *   1. Parse + normalize payload — resolve paymentId/invoiceId/status from
 *      either the nested `data` object or the flat root.
 *   2. System-context lookup of Invoice.
 *   3. System-context lookup of OrganizationPaymentConfig.
 *   4. Decrypt the webhook secret (HKDF context = SINGLE_TENANT_CONTEXT_ID).
 *   5. Verify the shared secret — via the HMAC
 *      `X-Moyasar-Signature` header when present, else the body `secret_token`.
 *   6. Idempotency check (keyed on paymentId:status, not the root event id).
 *   7. Re-fetch the payment from the Moyasar API (authoritative source of truth)
 *      and validate its amount/currency against the invoice (anti-spoof).
 *   8. Mutations under the default org compatibility CLS context.
 *
 * ── Error classification ──────────────────────────────────────────────────
 * Moyasar RETRIES any non-2xx response with backoff. A malformed or
 * maliciously-crafted webhook would otherwise be retried forever.
 *
 *   PERMANENT (drop + 200 ack):   never throws — logs and returns
 *   `{ skipped: true, reason }`. Covers: missing metadata/invoice, missing
 *   payment config, webhook-secret decrypt failure, missing/invalid signature
 *   (no HMAC header AND no body secret_token, or a bad one),
 *   amount/currency mismatch, Moyasar 404 (payment does not exist), and a
 *   non-terminal fetched status (a later webhook carries the terminal one).
 *
 *   TRANSIENT (propagate → 5xx):  genuine infrastructure failures (DB errors,
 *   transaction deadlocks, a Moyasar re-fetch failing with a network/5xx
 *   error) propagate so Moyasar retries — a retry can legitimately succeed.
 *
 * Why DB before signature: the encrypted webhook secret is stored in the
 * payment config, so we cannot verify a signature before loading that config.
 * The endpoint is rate-limited (Throttle 120/min) and rejections return the
 * same generic 200 ack to avoid acting as an oracle.
 */
@Injectable()
export class MoyasarWebhookHandler {
  private readonly logger = new Logger(MoyasarWebhookHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
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

  /**
   * Constant-time comparison of a body-supplied `secret_token` against the
   * stored webhook secret. Some merchant webhook configs put the
   * shared secret in the body instead of an `X-Moyasar-Signature` HMAC header
   * (see the Moyasar security reference §6.4). Returns `true` on an exact
   * match, `false` otherwise — never throws.
   */
  verifySecretToken(bodySecret: string, secret: string): boolean {
    const bodyBuf = Buffer.from(bodySecret, 'utf8');
    const secretBuf = Buffer.from(secret, 'utf8');
    if (bodyBuf.length !== secretBuf.length) {
      return false;
    }
    return timingSafeEqual(bodyBuf, secretBuf);
  }

  async execute(req: MoyasarWebhookRequest): Promise<MoyasarWebhookResult> {
    // STAGE 1 — parse + NORMALIZE the payload.
    //
    // Moyasar's documented webhook shape is NESTED — an event envelope at the
    // root (`id` = event id, `type`, `secret_token`) wrapping the payment
    // object under `data`. Some merchant configs / legacy callers deliver the
    // FLAT shape with the payment fields at the root. Normalize both into one
    // internal object so the rest of the handler is shape-agnostic.
    const payload = req.payload;
    const paymentId = payload.data?.id ?? payload.id;
    const normalizedStatus = payload.data?.status ?? payload.status;
    const invoiceId = payload.data?.metadata?.invoiceId ?? payload.metadata?.invoiceId;
    const message = payload.data?.message ?? payload.message;
    const bodySecret = payload.secret_token;

    if (!paymentId || !invoiceId) {
      // Permanent: a payload that resolves to neither a payment id nor an
      // invoice id can never be acted on — drop-and-ack.
      this.logger.warn(
        `Moyasar webhook missing metadata (payment=${paymentId ?? 'none'} invoice=${invoiceId ?? 'none'})`,
      );
      return { skipped: true, reason: 'missing_metadata' };
    }

    // STAGE 2 — read invoice in system context.
    const invoice = await this.cls.run(async () => {
      this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
      return this.prisma.invoice.findFirst({ where: { id: invoiceId } });
    });
    if (!invoice) {
      this.logger.warn(
        `Moyasar webhook references unknown invoice ${invoiceId} (payment ${paymentId})`,
      );
      return { skipped: true, reason: 'invoice_not_found' };
    }

    // STAGE 3 — fetch payment config in system context.
    const cfg = await this.cls.run(async () => {
      this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
      return this.prisma.organizationPaymentConfig.findUnique({
        where: { singletonKey: PAYMENT_CONFIG_SINGLETON_KEY },
      });
    });
    if (!cfg) {
      // Permanent: no Moyasar config means this deployment cannot ever verify
      // the webhook. Drop-and-ack so Moyasar stops retrying.
      this.logger.error(
        `Moyasar webhook rejected: no OrganizationPaymentConfig (payment ${paymentId})`,
      );
      return { skipped: true, reason: 'missing_payment_config' };
    }

    // STAGE 4 — decrypt the webhook secret (HKDF context = SINGLE_TENANT_CONTEXT_ID).
    let webhookSecret: string;
    try {
      const decoded = this.creds.decrypt<{ webhookSecret: string }>(
        cfg.webhookSecretEnc,
        SINGLE_TENANT_CONTEXT_ID,
      );
      webhookSecret = decoded.webhookSecret;
    } catch (err) {
      // Permanent: a corrupt/unreadable secret will never decrypt on retry.
      this.logger.error(
        `Moyasar webhook rejected: failed to decrypt webhook secret for context ${SINGLE_TENANT_CONTEXT_ID} ` +
          `(payment ${paymentId}): ${errorMessage(err)}`,
      );
      return { skipped: true, reason: 'webhook_secret_decrypt_failed' };
    }

    // STAGE 5 — verify the shared secret.
    //
    // Moyasar webhook configs verify via ONE of two channels (security ref §6.4):
    //   - an `X-Moyasar-Signature` HMAC header over the raw body, OR
    //   - a `secret_token` field carried in the body itself.
    // We support both: prefer the HMAC header when present, otherwise fall
    // back to the body token. If NEITHER is present, the webhook is
    // unverifiable — drop-and-ack so Moyasar stops retrying.
    if (req.signature) {
      if (!this.verifySignature(req.rawBody, req.signature, webhookSecret)) {
        // Permanent: a forged/invalid signature will never become valid on retry.
        // Returning 200 stops the retry storm and avoids acting as an oracle.
        this.logger.warn(
          `Moyasar webhook rejected: invalid signature for payment ${paymentId} (invoice ${invoiceId})`,
        );
        return { skipped: true, reason: 'invalid_signature' };
      }
    } else if (bodySecret) {
      if (!this.verifySecretToken(bodySecret, webhookSecret)) {
        // Permanent: a wrong body secret_token will never become valid on retry.
        this.logger.warn(
          `Moyasar webhook rejected: invalid secret_token for payment ${paymentId} (invoice ${invoiceId})`,
        );
        return { skipped: true, reason: 'invalid_signature' };
      }
    } else {
      // Permanent: no HMAC header and no body secret_token — the webhook
      // cannot be authenticated. Drop-and-ack with HTTP 200.
      this.logger.warn(
        `Moyasar webhook rejected: no signature header and no secret_token ` +
          `for payment ${paymentId} (invoice ${invoiceId})`,
      );
      return { skipped: true, reason: 'missing_signature' };
    }

    // STAGE 6 — idempotency dedup via WebhookEvent (covers ALL statuses, not
    // just COMPLETED). Moyasar retries failed-payment webhooks — without this
    // guard every retry would re-emit PaymentFailedEvent and re-run mutations.
    // We use the optimistic-insert pattern (create → catch P2002) so the dedup
    // is atomic under concurrent retries. WebhookEvent is a system-level table,
    // so plain this.prisma.webhookEvent works without a CLS bypass.
    // The dedup key is keyed on the PAYMENT id + status, NOT the root event
    // id. In the nested shape `payload.id` is the EVENT id — unique per
    // delivery — so keying on it would let every retry through and defeat
    // dedup. `${paymentId}:${status}` is stable across retries of the same
    // event (so retries dedup) yet distinct per status transition of the same
    // payment (so a paid→refunded sequence still processes), and is identical
    // for both the flat and nested shapes.
    const webhookEventId = `${paymentId}:${normalizedStatus ?? 'unknown'}`;
    const payloadHash = createHash('sha256').update(req.rawBody).digest('hex');

    let webhookEventRowId: string;
    try {
      const created = await this.prisma.webhookEvent.create({
        data: {
          provider: 'MOYASAR_TENANT',
          eventId: webhookEventId,
          eventType: normalizedStatus ?? 'unknown',
          payloadHash,
        },
        select: { id: true },
      });
      webhookEventRowId = created.id;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        this.logger.log(
          `Moyasar webhook: skipped_duplicate provider=MOYASAR_TENANT eventId=${webhookEventId}`,
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
        fetched = await this.moyasarApi.getPaymentStatus(DEFAULT_ORG_ID, paymentId);
      } catch (err) {
        if (err instanceof NotFoundException) {
          // Permanent: Moyasar says this payment does not exist. Drop-and-ack.
          this.logger.error(
            `Moyasar webhook rejected: payment ${paymentId} not found on re-fetch (invoice ${invoiceId})`,
          );
          await this.markWebhookEvent(webhookEventRowId, 'error');
          return { skipped: true, reason: 'payment_not_found' };
        }
        // Transient: network error / 5xx / timeout — propagate so Moyasar retries.
        throw err;
      }

      // Verify the re-fetched payment matches the OUTSTANDING balance it claims
      // to pay. invoice.total and Payment.amount are both in halalas; Moyasar
      // amount is in halalas. An invoice may already carry a collected deposit,
      // so the authoritative figure to match is the outstanding remainder
      // (total − Σ COMPLETED), NOT the full total. Sum COMPLETED payments in
      // system context (this is a read; the mutation transaction re-derives the
      // figures below for atomicity).
      const expectedTotal = Math.round(Number(invoice.total));
      const { outstanding, alreadyPaid, hasExistingRow, depositAmount } = await this.cls.run(
        async () => {
          this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
          const priorPaid = await this.prisma.payment.aggregate({
            where: { invoiceId: invoice.id, status: PaymentStatus.COMPLETED },
            _sum: { amount: true },
          });
          // A Payment row already keyed to THIS Moyasar payment means this is a
          // retry / re-delivery of an event we already wrote (the row may itself
          // be the COMPLETED one folded into priorPaid). Such retries must not be
          // re-validated against a now-shrunken outstanding — they are exempt.
          const existing = await this.prisma.payment.findFirst({
            where: { OR: [{ gatewayRef: paymentId }, { idempotencyKey: `moyasar:${paymentId}` }] },
            select: { id: true },
          });
          // Resolve the configured deposit for the invoice's service so a
          // deposit-sized first payment is accepted by the anti-spoof guard.
          const deposit = await resolveInvoiceDeposit(this.prisma, invoice.bookingId);
          const paidSoFar = Number(priorPaid._sum?.amount ?? 0);
          return {
            outstanding: expectedTotal - paidSoFar,
            alreadyPaid: paidSoFar,
            hasExistingRow: existing !== null,
            depositAmount: deposit.enabled ? deposit.depositAmount : null,
          };
        },
      );
      // Anti-spoof: a brand-new payment must match the outstanding balance
      // exactly — OR, on a deposit-enabled service with no money collected yet,
      // the exact configured deposit. Retries that re-fetch an existing payment
      // row are exempt.
      const acceptsDeposit =
        depositAmount != null && alreadyPaid === 0 && fetched.amount === depositAmount;
      if (!hasExistingRow && fetched.amount !== outstanding && !acceptsDeposit) {
        // Permanent: a spoofed/mismatched amount will never match on retry.
        this.logger.error(
          `Moyasar webhook rejected: amount mismatch for invoice ${invoice.id} ` +
            `(outstanding=${outstanding} total=${expectedTotal} fetched=${fetched.amount} payment=${paymentId})`,
        );
        await this.markWebhookEvent(webhookEventRowId, 'error');
        return { skipped: true, reason: 'amount_mismatch' };
      }
      if (fetched.currency.toUpperCase() !== invoice.currency.toUpperCase()) {
        // Permanent: currency mismatch will never match on retry.
        this.logger.error(
          `Moyasar webhook rejected: currency mismatch for invoice ${invoice.id} ` +
            `(expected=${invoice.currency} fetched=${fetched.currency} payment=${paymentId})`,
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
          `Moyasar webhook: payment ${paymentId} not yet terminal ` +
            `(status=${fetched.status}, invoice ${invoice.id}) — skipping`,
        );
        await this.markWebhookEvent(webhookEventRowId, 'processed');
        return { skipped: true, reason: `non_terminal_status:${fetched.status}` };
      }

      // STAGE 8 — run mutations inside the default org compatibility CLS context.
      // Payment.amount is stored in halalas — fetched.amount is already halalas.
      const amountHalalas = fetched.amount;
      // Σ COMPLETED payments AFTER the write — needed outside the tx to decide
      // whether a deposit-sized partial payment should emit DepositPaidEvent.
      let paidAfterWrite = 0;
      const result = await this.cls.run(async () => {
        this.cls.set(TENANT_CLS_KEY, {
          organizationId: DEFAULT_ORG_ID,
          id: 'system',
          role: 'system',
          isSuperAdmin: false,
        });

        // Guard: never overwrite a terminal (REFUNDED) payment back to COMPLETED/FAILED.
        const existingPayment = await this.prisma.payment.findFirst({
          where: { OR: [{ gatewayRef: paymentId }, { idempotencyKey: `moyasar:${paymentId}` }] },
          orderBy: [{ gatewayRef: 'desc' }, { updatedAt: 'desc' }],
          select: { status: true },
        });
        if (existingPayment?.status === PaymentStatus.REFUNDED) {
          this.logger.warn(
            `Webhook: skipping update for REFUNDED payment (gatewayRef=${paymentId})`,
          );
          return { skipped: true, reason: 'already_refunded' } as MoyasarWebhookResult;
        }
        // SECURITY (P1): refuse webhook-driven status regressions. A replayed
        // `failed` or `voided` event arriving after the payment is already
        // COMPLETED must not flip it back — `payment.upsert` would otherwise
        // silently overwrite status. Same for COMPLETED→PENDING.
        if (existingPayment) {
          try {
            assertValidTransition(existingPayment.status, status);
          } catch {
            this.logger.warn(
              `Webhook: refusing payment status regression ${existingPayment.status} → ${status} (gatewayRef=${paymentId})`,
            );
            return { skipped: true, reason: 'invalid_transition' } as MoyasarWebhookResult;
          }
        }

        // Wrap payment upsert + invoice update + domain-event outbox write in a
        // single transaction to ensure atomicity — if any step fails, all roll
        // back and no inconsistent state is stored. `savedPayment.id` is the
        // internal Payment ROW id; `paymentId` (above) is the Moyasar gateway
        // payment id — they are distinct values.
        await this.rlsTransaction.withTransaction(async (tx) => {
          const payment = await tx.payment.findFirst({
            where: { OR: [{ gatewayRef: paymentId }, { idempotencyKey: `moyasar:${paymentId}` }] },
            orderBy: [{ gatewayRef: 'desc' }, { updatedAt: 'desc' }],
            select: { id: true },
          });

          const savedPayment = payment
            ? await tx.payment.update({
                where: { id: payment.id },
                data: {
                  status,
                  processedAt: status === PaymentStatus.COMPLETED ? new Date() : undefined,
                  failureReason: message,
                  gatewayRef: paymentId,
                  idempotencyKey: `moyasar:${paymentId}`,
                },
              })
            : await tx.payment.create({
                data: {
              invoiceId,
              amount: amountHalalas,
              currency: fetched.currency,
              method: PaymentMethod.ONLINE_CARD,
              status,
              gatewayRef: paymentId,
              idempotencyKey: `moyasar:${paymentId}`,
              processedAt: status === PaymentStatus.COMPLETED ? new Date() : undefined,
              failureReason: message,
                },
              });

          let fullyPaid = false;
          if (status === PaymentStatus.COMPLETED) {
            // P0: re-aggregate COMPLETED payments AFTER the write and derive the
            // invoice status from the total collected — a top-up that only
            // covers part of the balance must land PARTIALLY_PAID, not PAID.
            // paidAt is stamped ONLY when the invoice is fully settled. Mirrors
            // ProcessPaymentHandler so card and operator payments agree.
            const totalPaid = await tx.payment.aggregate({
              where: { invoiceId, status: PaymentStatus.COMPLETED },
              _sum: { amount: true },
            });
            const paid = Number(totalPaid._sum?.amount ?? 0);
            const total = Math.round(Number(invoice.total));
            fullyPaid = paid >= total;
            paidAfterWrite = paid;
            await tx.invoice.update({
              where: { id: invoiceId },
              data: {
                status: fullyPaid ? 'PAID' : 'PARTIALLY_PAID',
                // Stamp issuance time on the first payment that lifts the invoice
                // out of DRAFT; keep an existing issuedAt untouched.
                issuedAt: invoice.issuedAt ?? new Date(),
                paidAt: fullyPaid ? new Date() : undefined,
              },
            });
          }

          // P1-12: write domain events to the OutboxEvent table INSIDE this same
          // transaction instead of publishing directly after commit. The previous
          // code awaited eventBus.publish() AFTER the tx committed — if the process
          // crashed (or the broker was unreachable) in that window, the event was
          // lost forever: the payment was COMPLETED and the invoice PAID, but the
          // booking never confirmed and no receipt was sent, and nothing could
          // rescue it. By staging the event in the same atomic write, the
          // OutboxPublisherCron guarantees at-least-once delivery — mirrors the
          // create-booking outbox pattern.
          //
          // PaymentCompletedEvent is staged ONLY when the invoice is fully PAID —
          // downstream consumers (booking confirmation, receipts) must not react
          // to a still-outstanding invoice.
          if (status === PaymentStatus.COMPLETED && fullyPaid) {
            const event = new PaymentCompletedEvent({
              paymentId: savedPayment.id,
              invoiceId: invoice.id,
              bookingId: invoice.bookingId,
              packagePurchaseId: invoice.packagePurchaseId,
              amount: amountHalalas,
              currency: invoice.currency,
              organizationId: DEFAULT_ORG_ID,
            });
            await tx.outboxEvent.create({
              data: {
                aggregateId: invoice.id,
                eventType: event.eventName,
                payload: event.toEnvelope() as unknown as Prisma.InputJsonValue,
              },
            });
          } else if (
            status === PaymentStatus.COMPLETED &&
            isDepositPayment({
              paidAfter: paidAfterWrite,
              total: Math.round(Number(invoice.total)),
              depositAmount,
            })
          ) {
            // The card payment exactly matched the configured deposit and the
            // invoice is still PARTIALLY_PAID — move the booking to DEPOSIT_PAID
            // (reserving staff time) without confirming the appointment.
            const event = new DepositPaidEvent({
              paymentId: savedPayment.id,
              invoiceId: invoice.id,
              bookingId: invoice.bookingId,
              amount: amountHalalas,
              currency: invoice.currency,
              organizationId: DEFAULT_ORG_ID,
            });
            await tx.outboxEvent.create({
              data: {
                aggregateId: invoice.id,
                eventType: event.eventName,
                payload: event.toEnvelope() as unknown as Prisma.InputJsonValue,
              },
            });
          } else if (status === PaymentStatus.FAILED) {
            const failedEvent = new PaymentFailedEvent({
              paymentId: savedPayment.id,
              invoiceId: invoice.id,
              clientId: invoice.clientId,
              amount: amountHalalas,
              currency: invoice.currency,
              reason: message,
            });
            await tx.outboxEvent.create({
              data: {
                aggregateId: invoice.id,
                eventType: failedEvent.eventName,
                payload: failedEvent.toEnvelope() as unknown as Prisma.InputJsonValue,
              },
            });
          }

        });

        // Metrics are best-effort observability only — they carry no fulfillment
        // semantics, so they stay outside the transaction. The success metric
        // increments on ANY COMPLETED card payment (a partial top-up is still a
        // successful charge).
        if (status === PaymentStatus.COMPLETED) {
          this.appMetrics?.paymentAttempts.labels({ result: 'succeeded' }).inc();
        } else if (status === PaymentStatus.FAILED) {
          this.appMetrics?.paymentAttempts.labels({ result: 'failed' }).inc();
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
