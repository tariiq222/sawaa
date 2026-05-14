// SaaS-02g-sms — Taqnyat REST adapter.

import { createHmac, timingSafeEqual } from 'crypto';
import { fetchWithTimeout } from '../http';
import type {
  DlrPayload,
  ParsedDlr,
  SmsProvider,
  SmsSendResult,
} from './sms-provider.interface';

export type TaqnyatCredentials = { apiToken: string };

const TAQNYAT_ENDPOINT = 'https://api.taqnyat.sa/v1/messages';

type TaqnyatResponse = {
  statusCode?: number;
  messageId?: string | number;
  message?: string;
};

type TaqnyatDlrBody = {
  messageId?: string | number;
  status?: string;
  errorCode?: string;
  errorMessage?: string;
};

export class TaqnyatAdapter implements SmsProvider {
  readonly name = 'TAQNYAT' as const;

  constructor(private readonly creds: TaqnyatCredentials) {}

  async send(
    to: string,
    body: string,
    senderId: string | null,
  ): Promise<SmsSendResult> {
    const payload: Record<string, string> = {
      recipients: to,
      body,
    };
    if (senderId) payload.sender = senderId;

    const res = await fetchWithTimeout(
      TAQNYAT_ENDPOINT,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.creds.apiToken}`,
        },
        body: JSON.stringify(payload),
      },
      8_000,
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Taqnyat HTTP ${res.status}: ${text}`);
    }
    const json = (await res.json()) as TaqnyatResponse;
    if (json.statusCode !== 200 || !json.messageId) {
      throw new Error(`Taqnyat error: ${JSON.stringify(json)}`);
    }
    return {
      providerMessageId: String(json.messageId),
      status: 'SENT',
    };
  }

  verifyDlrSignature(payload: DlrPayload, webhookSecret: string): void {
    const expected = createHmac('sha256', webhookSecret)
      .update(payload.rawBody)
      .digest('hex');
    const a = Buffer.from(expected, 'hex');
    let b: Buffer;
    try {
      b = Buffer.from(payload.signature, 'hex');
    } catch {
      throw new Error('Taqnyat DLR signature malformed');
    }
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error('Taqnyat DLR signature mismatch');
    }
  }

  parseDlr(rawBody: string): ParsedDlr {
    const p = JSON.parse(rawBody) as TaqnyatDlrBody;
    if (!p.messageId) throw new Error('Taqnyat DLR missing messageId');
    const status: ParsedDlr['status'] =
      typeof p.status === 'string' && p.status.toLowerCase() === 'delivered'
        ? 'DELIVERED'
        : 'FAILED';
    return {
      providerMessageId: String(p.messageId),
      status,
      errorCode: p.errorCode,
      errorMessage: p.errorMessage,
    };
  }
}
