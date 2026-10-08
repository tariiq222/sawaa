import { MoyasarPaymentSettlementHandler } from '../moyasar-payment-settlement/moyasar-payment-settlement.handler';
import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { createHmac, createHash, randomUUID, timingSafeEqual } from 'crypto';
import { Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { MoyasarCredentialsService } from '../../../infrastructure/payments/moyasar-credentials.service';
import { DEFAULT_ORG_ID, PAYMENT_CONFIG_SINGLETON_KEY, SINGLE_TENANT_CONTEXT_ID, SYSTEM_CONTEXT_CLS_KEY, TENANT_CLS_KEY } from '../../../common/constants';
import { errorMessage } from '../../../common/helpers/error-message.helper';
import { MoyasarWebhookDto } from './moyasar-webhook.dto';
import { MoyasarApiClient, MoyasarPaymentStatusResult } from '../moyasar-api/moyasar-api.client';

const WEBHOOK_CLAIM_LEASE_MS = 5 * 60 * 1_000;

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

interface WebhookClaim {
  rowId: string;
  ownerToken: string;
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
 *   1. Parse + normalize payload — resolve paymentId/invoice_id/status from
 *      either the nested `data` object or the flat root.
 *   2. Resolve the internal Invoice from metadata or the hosted-checkout
 *      Payment row keyed by the gateway invoice/payment identity.
 *   3. System-context lookup of OrganizationPaymentConfig.
 *   4. Decrypt the webhook secret (HKDF context = SINGLE_TENANT_CONTEXT_ID).
 *   5. Verify the shared secret — via the HMAC
 *      `X-Moyasar-Signature` header when present, else the body `secret_token`.
 *   6. Idempotency check (keyed on paymentId:status, not the root event id).
 *   7. Re-fetch the payment from the Moyasar API (authoritative source of truth),
 *      use its invoiceId as a final routing fallback, and validate the
 *      amount/currency against the invoice (anti-spoof).
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
    private readonly cls: ClsService,
    private readonly creds: MoyasarCredentialsService,
    private readonly moyasarApi: MoyasarApiClient,
    private readonly settlement: MoyasarPaymentSettlementHandler,
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
    const metadataInvoiceId =
      payload.data?.metadata?.invoiceId ?? payload.metadata?.invoiceId;
    const payloadGatewayInvoiceId = payload.data?.invoice_id ?? payload.invoice_id;
    const message = payload.data?.message ?? payload.message;
    const bodySecret = payload.secret_token;

    if (!paymentId) {
      // Permanent: without a payment id there is nothing authoritative to
      // re-fetch and no stable webhook/payment identity to process.
      this.logger.warn(
        'Moyasar webhook missing metadata (payment=none invoice=unresolved)',
      );
      return { skipped: true, reason: 'missing_metadata' };
    }

    // Hosted invoice checkout creates a PENDING Payment before redirecting to
    // Moyasar. At that point gatewayRef is the Moyasar invoice UUID, not the
    // eventual payment UUID. Route through either identity so the webhook can
    // recover the internal Invoice even when Moyasar omitted our metadata.
    const initialGatewayRefs = [paymentId, payloadGatewayInvoiceId].filter(
      (value): value is string => Boolean(value),
    );
    let routedPayment = await this.findPaymentRoute(initialGatewayRefs);
    let invoiceId = metadataInvoiceId ?? routedPayment?.invoiceId;

    // An explicit gateway invoice that maps to no hosted-checkout attempt is
    // unknown to this deployment. Ack safely without creating a new Payment.
    if (payloadGatewayInvoiceId && !metadataInvoiceId && !routedPayment) {
      this.logger.warn(
        `Moyasar webhook references unknown gateway invoice ${payloadGatewayInvoiceId} ` +
          `(payment ${paymentId})`,
      );
      return { skipped: true, reason: 'invoice_not_found' };
    }

    // Preserve the fast/safe metadata path: reject an unknown internal invoice
    // before loading secrets or calling Moyasar. The fetched-invoice fallback
    // below is used only when neither metadata nor the initial route resolved.
    let invoice = invoiceId ? await this.cls.run(async () => {
      this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
      return this.prisma.invoice.findFirst({ where: { id: invoiceId } });
    }) : null;
    if (invoiceId && !invoice) {
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
          `Moyasar webhook rejected: invalid signature for payment ${paymentId} ` +
            `(invoice ${invoiceId ?? payloadGatewayInvoiceId ?? 'unresolved'})`,
        );
        return { skipped: true, reason: 'invalid_signature' };
      }
    } else if (bodySecret) {
      if (!this.verifySecretToken(bodySecret, webhookSecret)) {
        // Permanent: a wrong body secret_token will never become valid on retry.
        this.logger.warn(
          `Moyasar webhook rejected: invalid secret_token for payment ${paymentId} ` +
            `(invoice ${invoiceId ?? payloadGatewayInvoiceId ?? 'unresolved'})`,
        );
        return { skipped: true, reason: 'invalid_signature' };
      }
    } else {
      // Permanent: no HMAC header and no body secret_token — the webhook
      // cannot be authenticated. Drop-and-ack with HTTP 200.
      this.logger.warn(
        `Moyasar webhook rejected: no signature header and no secret_token ` +
          `for payment ${paymentId} ` +
            `(invoice ${invoiceId ?? payloadGatewayInvoiceId ?? 'unresolved'})`,
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

    const webhookClaim = await this.claimWebhookEvent(
      webhookEventId,
      normalizedStatus ?? 'unknown',
      payloadHash,
    );
    if (!webhookClaim) {
      this.logger.log(
        `Moyasar webhook: skipped_duplicate provider=MOYASAR_TENANT eventId=${webhookEventId}`,
      );
      return { skipped: true, reason: 'duplicate' };
    }

    try {
      // STAGE 7 — re-fetch the AUTHORITATIVE payment from the Moyasar API.
      // A signed webhook only proves the message came from Moyasar; the body
      // could be a stale/replayed (but validly-signed) payload. We trust the
      // re-fetched status/amount/currency, NOT the request body.
      let fetched: MoyasarPaymentStatusResult & {invoice_id?: string};
      try {
        fetched = await this.moyasarApi.getPaymentStatus(DEFAULT_ORG_ID, paymentId);
      } catch (err) {
        if (err instanceof NotFoundException) {
          // Permanent: Moyasar says this payment does not exist. Drop-and-ack.
          this.logger.error(
            `Moyasar webhook rejected: payment ${paymentId} not found on re-fetch ` +
              `(invoice ${invoiceId ?? payloadGatewayInvoiceId ?? 'unresolved'})`,
          );
          await this.markWebhookEvent(webhookClaim, 'error');
          return { skipped: true, reason: 'payment_not_found' };
        }
        // Transient: network error / 5xx / timeout — propagate so Moyasar retries.
        throw err;
      }

      const authoritativeGatewayInvoiceId = fetched.invoiceId ?? fetched.invoice_id;
      const gatewayRefs = [
        paymentId,
        payloadGatewayInvoiceId,
        authoritativeGatewayInvoiceId,
      ].filter((value, index, values): value is string =>
        Boolean(value) && values.indexOf(value) === index,
      );

      // A signed payload can still carry merchant-supplied metadata from a
      // different checkout. Never let metadata redirect a hosted-invoice
      // payment away from the internal Payment row already bound to that
      // gateway identity.
      if (!routedPayment && authoritativeGatewayInvoiceId) {
        routedPayment = await this.findPaymentRoute([
          authoritativeGatewayInvoiceId,
          paymentId,
        ]);
      }
      if (
        metadataInvoiceId &&
        routedPayment &&
        routedPayment.invoiceId &&
        metadataInvoiceId !== routedPayment.invoiceId
      ) {
        this.logger.error(
          `Moyasar webhook invoice mismatch for payment ${paymentId} ` +
            `(metadata=${metadataInvoiceId} routed=${routedPayment.invoiceId})`,
        );
        await this.markWebhookEvent(webhookClaim, 'error');
        return { skipped: true, reason: 'invoice_mismatch' };
      }

      if (!invoice) {
        routedPayment ??= await this.findPaymentRoute(gatewayRefs);
        invoiceId = metadataInvoiceId ?? routedPayment?.invoiceId;
        if (!invoiceId) {
          const hasGatewayInvoice = Boolean(
            payloadGatewayInvoiceId ?? authoritativeGatewayInvoiceId,
          );
          this.logger.warn(
            `Moyasar webhook could not resolve an internal invoice for payment ${paymentId}`,
          );
          await this.markWebhookEvent(webhookClaim, 'error');
          return {
            skipped: true,
            reason: hasGatewayInvoice ? 'invoice_not_found' : 'missing_metadata',
          };
        }
        invoice = await this.cls.run(async () => {
          this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
          return this.prisma.invoice.findFirst({ where: { id: invoiceId } });
        });
        if (!invoice) {
          this.logger.warn(
            `Moyasar webhook references unknown invoice ${invoiceId} (payment ${paymentId})`,
          );
          await this.markWebhookEvent(webhookClaim, 'error');
          return { skipped: true, reason: 'invoice_not_found' };
        }
      }

      const resolvedInvoiceId = invoice.id;
      const result = await this.cls.run(async () => {
        this.cls.set(TENANT_CLS_KEY, {organizationId:DEFAULT_ORG_ID,id:'system',role:'system',isSuperAdmin:false});
        const { requiresReview: _requiresReview, ...result } = await this.settlement.execute({
          invoiceId: resolvedInvoiceId, gatewayPaymentId: paymentId, gatewayRefs, fetched, message,
        });
        return result;
      });

      const claimResult = [
        'amount_mismatch',
        'currency_mismatch',
        'invoice_not_found',
        'terminal_invoice',
      ].includes(result.reason ?? '')
        ? 'error'
        : 'processed';
      await this.markWebhookEvent(webhookClaim, claimResult);

      return result;
    } catch (err) {
      // The event row is a dedup claim until this delivery is marked processed.
      // Delete it on any thrown infrastructure error so Moyasar can retry —
      // including failures after the mutation transaction, which rolled back
      // atomically. If a commit did happen before a later exception, payment
      // idempotency and the transition guard make the retry a no-op.
      await this.discardWebhookEvent(webhookClaim);
      throw err;
    }
  }

  private async findPaymentRoute(gatewayRefs: readonly string[]): Promise<{
    id: string;
    invoiceId: string;
    status: PaymentStatus;
  } | null> {
    if (gatewayRefs.length === 0) return null;
    return this.cls.run(async () => {
      this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
      return this.prisma.payment.findFirst({
        where: {
          OR: gatewayRefs.map((gatewayRef) => ({ gatewayRef })),
        },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, invoiceId: true, status: true },
      });
    });
  }

  private async claimWebhookEvent(
    eventId: string,
    eventType: string,
    payloadHash: string,
  ): Promise<WebhookClaim | null> {
    const now = new Date();
    const ownerToken = randomUUID();
    const processingResult = `processing:${ownerToken}`;
    try {
      const created = await this.prisma.webhookEvent.create({
        data: {
          provider: 'MOYASAR_TENANT',
          eventId,
          eventType,
          payloadHash,
          result: processingResult,
          receivedAt: now,
        },
        select: { id: true },
      });
      return { rowId: created.id, ownerToken };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error;
      }
    }

    const existing = await this.prisma.webhookEvent.findUnique({
      where: {
        provider_eventId: { provider: 'MOYASAR_TENANT', eventId },
      },
      select: { id: true, processedAt: true, result: true, receivedAt: true },
    });
    if (existing?.processedAt) return null;
    if (!existing) {
      throw new ServiceUnavailableException('Webhook claim is temporarily unavailable');
    }

    const staleBefore = new Date(now.getTime() - WEBHOOK_CLAIM_LEASE_MS);
    const leaseIsLive =
      existing.result?.startsWith('processing:') && existing.receivedAt >= staleBefore;
    if (leaseIsLive) {
      // Moyasar must retry this delivery. A successful duplicate ACK is safe
      // only after processedAt is present; the current owner may have crashed.
      throw new ServiceUnavailableException('Webhook event is already being processed');
    }
    const claimed = await this.prisma.webhookEvent.updateMany({
      where: {
        id: existing.id,
        processedAt: null,
        result: existing.result,
        receivedAt: existing.receivedAt,
      },
      data: {
        result: processingResult,
        receivedAt: now,
        eventType,
        payloadHash,
      },
    });
    if (claimed.count !== 1) {
      throw new ServiceUnavailableException('Webhook claim changed while retrying');
    }
    return { rowId: existing.id, ownerToken };
  }

  private async markWebhookEvent(
    claim: WebhookClaim,
    result: 'processed' | 'error',
  ): Promise<void> {
    await this.prisma.webhookEvent
      .updateMany({
        where: {
          id: claim.rowId,
          processedAt: null,
          result: `processing:${claim.ownerToken}`,
        },
        data: { processedAt: new Date(), result },
      })
      .catch((updateErr) => {
        this.logger.error(
          `Failed to mark webhook event as ${result} (${claim.rowId}): ${String(updateErr)}`,
        );
      });
  }

  private async discardWebhookEvent(claim: WebhookClaim): Promise<void> {
    await this.prisma.webhookEvent
      .deleteMany({
        where: {
          id: claim.rowId,
          processedAt: null,
          result: `processing:${claim.ownerToken}`,
        },
      })
      .catch((deleteErr) => {
        this.logger.error(
          `Failed to discard transient webhook event (${claim.rowId}): ${String(deleteErr)}`,
        );
      });
  }
}
