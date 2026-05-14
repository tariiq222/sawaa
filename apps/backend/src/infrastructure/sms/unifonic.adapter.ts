// SaaS-02g-sms — Unifonic REST adapter.

import { createHmac, timingSafeEqual } from 'crypto';
import { fetchWithTimeout } from '../http';
import type {
  DlrPayload,
  ParsedDlr,
  SmsProvider,
  SmsSendResult,
} from './sms-provider.interface';

export type UnifonicCredentials = { appSid: string; apiKey: string };

const UNIFONIC_ENDPOINT = 'https://api.unifonic.com/rest/SMS/messages';

type UnifonicResponse = {
  success?: boolean;
  data?: { MessageID?: string | number };
  errorCode?: string;
  message?: string;
};

type UnifonicDlrBody = {
  messageId?: string | number;
  status?: string;
  errorCode?: string;
  errorMessage?: string;
};

export class UnifonicAdapter implements SmsProvider {
  readonly name = 'UNIFONIC' as const;

  constructor(private readonly creds: UnifonicCredentials) {}

  async send(
    to: string,
    body: string,
    senderId: string | null,
  ): Promise<SmsSendResult> {
    const payload: Record<string, string> = {
      AppSid: this.creds.appSid,
      Recipient: to,
      Body: body,
    };
    if (senderId) payload.SenderID = senderId;

    const res = await fetchWithTimeout(
      UNIFONIC_ENDPOINT,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.creds.apiKey}`,
        },
        body: JSON.stringify(payload),
      },
      8_000,
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Unifonic HTTP ${res.status}: ${text}`);
    }
    const json = (await res.json()) as UnifonicResponse;
    if (!json.success || !json.data?.MessageID) {
      throw new Error(`Unifonic error: ${JSON.stringify(json)}`);
    }
    return {
      providerMessageId: String(json.data.MessageID),
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
      throw new Error('Unifonic DLR signature malformed');
    }
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error('Unifonic DLR signature mismatch');
    }
  }

  parseDlr(rawBody: string): ParsedDlr {
    const p = JSON.parse(rawBody) as UnifonicDlrBody;
    if (!p.messageId) throw new Error('Unifonic DLR missing messageId');
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
