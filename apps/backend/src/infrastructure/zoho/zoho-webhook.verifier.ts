import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verifies Zoho's webhook signature.
 *
 * Zoho can sign outbound webhooks with a per-tenant secret using HMAC-SHA256
 * over the raw request body. The signature is delivered in the
 * `X-Zoho-Webhook-Signature` header (hex). We ignore casing on the header
 * value and compare in constant time.
 */
@Injectable()
export class ZohoWebhookVerifier {
  /**
   * @returns true when the signature matches OR when the tenant has not
   *          configured a webhook secret yet (in which case any caller can
   *          POST — but processing is strictly mirror-only, so the worst
   *          outcome is a status flap on a row we already mirror.
   *          We still recommend tenants configure the secret.)
   */
  verify(opts: { secret: string; rawBody: string; signature: string | undefined }): boolean {
    if (!opts.secret) return false;
    if (!opts.signature) return false;
    const expected = createHmac('sha256', opts.secret)
      .update(opts.rawBody, 'utf8')
      .digest('hex')
      .toLowerCase();
    const provided = opts.signature.trim().toLowerCase();
    if (expected.length !== provided.length) return false;
    try {
      return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(provided, 'utf8'));
    } catch {
      return false;
    }
  }
}
