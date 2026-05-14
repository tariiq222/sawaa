import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { fetchWithTimeout } from '../../../infrastructure/http';

@Injectable()
export class MoyasarSubscriptionClient {
  constructor(private readonly config: ConfigService) {}

  async getToken(tokenId: string): Promise<{
    id: string;
    status: string;
    brand: string;
    last4: string;
    expiryMonth: number;
    expiryYear: number;
    holderName: string | null;
  }> {
    const secretKey = this.config.getOrThrow<string>('MOYASAR_PLATFORM_SECRET_KEY');
    const response = await fetchWithTimeout(`https://api.moyasar.com/v1/tokens/${tokenId}`, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(secretKey + ':').toString('base64'),
      },
    }, 15000);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Moyasar token fetch failed: ${response.status} ${text}`);
    }

    const data = await response.json() as {
      id: string;
      status?: string;
      brand?: string;
      last_four?: string;
      last4?: string;
      month?: string | number;
      expiry_month?: string | number;
      year?: string | number;
      expiry_year?: string | number;
      name?: string | null;
    };

    return {
      id: data.id,
      status: data.status ?? 'unknown',
      brand: data.brand ?? 'unknown',
      last4: data.last_four ?? data.last4 ?? '',
      expiryMonth: Number(data.month ?? data.expiry_month),
      expiryYear: Number(data.year ?? data.expiry_year),
      holderName: data.name ?? null,
    };
  }

  async chargeWithToken(params: {
    token: string;
    amount: number; // minor units (halalas)
    currency: string;
    idempotencyKey: string;
    givenId?: string;
    description: string;
    callbackUrl: string;
  }): Promise<{ id: string; status: string; transactionUrl?: string | null }> {
    const secretKey = this.config.getOrThrow<string>('MOYASAR_PLATFORM_SECRET_KEY');
    const response = await fetchWithTimeout('https://api.moyasar.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(secretKey + ':').toString('base64'),
        'Idempotency-Key': params.idempotencyKey,
      },
      body: JSON.stringify({
        ...(params.givenId ? { given_id: params.givenId } : {}),
        amount: params.amount,
        currency: params.currency,
        description: params.description,
        source: { type: 'token', token: params.token },
        callback_url: params.callbackUrl,
      }),
    }, 15000);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Moyasar charge failed: ${response.status} ${text}`);
    }
    const data = await response.json() as {
      id: string;
      status: string;
      source?: { transaction_url?: string | null };
    };
    return {
      id: data.id,
      status: data.status,
      transactionUrl: data.source?.transaction_url ?? null,
    };
  }

  /**
   * Refund a previously paid Moyasar payment. Amount in halalas (1 SAR = 100).
   * Idempotency-Key prevents double-refunds on network retry.
   * Throws on non-2xx — handler must catch and surface to the admin caller.
   */
  async refundPayment(params: {
    paymentId: string;
    amountHalalas: number;
    idempotencyKey: string;
  }): Promise<{ id: string; amount: number; status: string }> {
    const secretKey = this.config.getOrThrow<string>('MOYASAR_PLATFORM_SECRET_KEY');
    const response = await fetchWithTimeout(
      `https://api.moyasar.com/v1/payments/${params.paymentId}/refund`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + Buffer.from(secretKey + ':').toString('base64'),
          'Idempotency-Key': params.idempotencyKey,
        },
        body: JSON.stringify({ amount: params.amountHalalas }),
      },
      15000,
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Moyasar refund failed: ${response.status} ${text}`);
    }
    return response.json() as Promise<{ id: string; amount: number; status: string }>;
  }

  async deleteToken(tokenId: string): Promise<void> {
    const secretKey = this.config.getOrThrow<string>('MOYASAR_PLATFORM_SECRET_KEY');
    const response = await fetchWithTimeout(`https://api.moyasar.com/v1/tokens/${tokenId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(secretKey + ':').toString('base64'),
      },
    }, 15000);

    if (!response.ok && response.status !== 204) {
      const text = await response.text();
      throw new Error(`Moyasar token delete failed: ${response.status} ${text}`);
    }
  }

  /**
   * Verifies the HMAC-SHA256 signature from Moyasar webhook requests.
   * Matches the approach used by MoyasarWebhookHandler: HMAC-SHA256 over
   * rawBody with the webhook secret, compared using timingSafeEqual.
   */
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const secret = this.config.getOrThrow<string>('MOYASAR_PLATFORM_WEBHOOK_SECRET');
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    const signatureBuf = Buffer.from(signature, 'hex');
    if (expectedBuf.length !== signatureBuf.length) return false;
    return timingSafeEqual(expectedBuf, signatureBuf);
  }
}
