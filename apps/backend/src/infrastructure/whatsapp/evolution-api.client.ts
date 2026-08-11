// evolution-api-client — thin HTTP client for Evolution API v2.
//
// Evolution API is a community-maintained open-source WhatsApp integration
// (https://github.com/EvolutionAPI/evolution-api). It wraps Baileys and exposes
// a clean REST surface, so we don't maintain the WebSocket protocol ourselves.
//
// Endpoints used:
//   GET    /instance/connectionState/{instance}     → connection state + phone
//   GET    /instance/connect/{instance}             → returns QR base64 (when pairing)
//   DELETE /instance/logout/{instance}             → graceful disconnect
//   POST   /instance/create                        → provision instance
//   POST   /instance/restart/{instance}            → restart instance
//   POST   /message/sendText/{instance}            → send text message
//   POST   /webhook/set/{instance}                 → register webhook URL
//
// Auth: apikey header. The key is owned by the backend environment.

import { Injectable, Logger } from '@nestjs/common';

export interface EvolutionConnectionState {
  instance: string;
  state:
    | 'open'
    | 'close'
    | 'connecting'
    | 'refused'
    | 'loggedOut'
    | 'qr';
  connectedPhone: string | null;
}

export interface SendTextInput {
  number: string; // E.164, e.g. +9665XXXXXXXX
  text: string;
  delay?: number;
}

export interface SendResult {
  ok: boolean;
  messageId?: string;
  external?: string;
  error?: string;
}

export interface QrPayload {
  pairingCode: string | null;
  code: string | null;
  base64: string | null;
  count: number;
}

@Injectable()
export class EvolutionApiClient {
  private readonly logger = new Logger(EvolutionApiClient.name);

  constructor(private readonly config: {
    baseUrl: string;
    apiKey: string;
    instanceName: string;
  }) {}

  /**
   * Validates the supplied base URL + key by issuing a lightweight connection
   * state request. Returns { ok: true, phone } on 200, { ok: false, error }
   * otherwise. Never throws.
   */
  async verify(): Promise<{ ok: boolean; state?: string; phone?: string; error?: string }> {
    try {
      const url = this.url(`/instance/connectionState/${this.config.instanceName}`);
      const res = await fetch(url, { headers: this.headers() });
      if (!res.ok) {
        const text = await res.text();
        return { ok: false, error: `Evolution API ${res.status}: ${text.slice(0, 200)}` };
      }
      const data = (await res.json()) as {
        instance?: { state?: string; ownerJid?: string };
        state?: string;
      };
      const state = data.instance?.state ?? data.state ?? 'unknown';
      const phone = data.instance?.ownerJid
        ? this.normalizePhoneFromJid(data.instance.ownerJid)
        : null;
      return { ok: true, state, phone: phone ?? undefined };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Network error';
      this.logger.warn(`Evolution API verify failed: ${message}`);
      return { ok: false, error: message };
    }
  }

  async getConnectionState(): Promise<EvolutionConnectionState> {
    const url = this.url(`/instance/connectionState/${this.config.instanceName}`);
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Evolution API ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      instance?: {
        instanceName?: string;
        state?: string;
        ownerJid?: string;
      };
      state?: string;
    };
    const rawState = data.instance?.state ?? data.state ?? 'close';
    const state = this.normalizeState(rawState);
    const phone = data.instance?.ownerJid
      ? this.normalizePhoneFromJid(data.instance.ownerJid)
      : null;
    return {
      instance: data.instance?.instanceName ?? this.config.instanceName,
      state,
      connectedPhone: phone,
    };
  }

  async getQr(): Promise<QrPayload> {
    const url = this.url(`/instance/connect/${this.config.instanceName}`);
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Evolution API ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      pairingCode?: string | null;
      code?: string | null;
      base64?: string | null;
      count?: number;
    };
    return {
      pairingCode: data.pairingCode ?? null,
      code: data.code ?? null,
      base64: data.base64 ?? null,
      count: data.count ?? 0,
    };
  }

  async createInstance(): Promise<{ created: boolean }> {
    const res = await fetch(this.url('/instance/create'), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        instanceName: this.config.instanceName,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
      }),
    });
    if (res.ok) return { created: true };
    if (res.status === 409) return { created: false };

    const text = await res.text();
    throw new Error(`Evolution API ${res.status}: ${text.slice(0, 200)}`);
  }

  async logout(): Promise<{ ok: true }> {
    const url = this.url(`/instance/logout/${this.config.instanceName}`);
    const res = await fetch(url, { headers: this.headers(), method: 'DELETE' });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Evolution API ${res.status}: ${text.slice(0, 200)}`);
    }
    return { ok: true };
  }

  async restart(): Promise<{ ok: true }> {
    const url = this.url(`/instance/restart/${this.config.instanceName}`);
    const res = await fetch(url, { headers: this.headers(), method: 'POST' });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Evolution API ${res.status}: ${text.slice(0, 200)}`);
    }
    return { ok: true };
  }

  async sendText(input: SendTextInput): Promise<SendResult> {
    try {
      const url = this.url(`/message/sendText/${this.config.instanceName}`);
      const res = await fetch(url, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          number: input.number.replace(/\D/g, ''),
          text: input.text,
          delay: input.delay ?? 0,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        return { ok: false, error: `Evolution API ${res.status}: ${text.slice(0, 200)}` };
      }
      const data = (await res.json()) as {
        key?: { id?: string };
        messageId?: string;
      };
      return {
        ok: true,
        messageId: data.key?.id ?? data.messageId,
        external: data.key?.id,
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Network error';
      this.logger.warn(`Evolution sendText failed: ${message}`);
      return { ok: false, error: message };
    }
  }

  async setWebhook(
    webhookUrl: string,
    jwtKey: string,
    events: string[] = ['MESSAGES_UPSERT'],
  ): Promise<{ ok: true }> {
    const url = this.url(`/webhook/set/${this.config.instanceName}`);
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: webhookUrl,
          headers: { jwt_key: jwtKey },
          byEvents: false,
          base64: false,
          events,
        },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Evolution API ${res.status}: ${text.slice(0, 200)}`);
    }
    return { ok: true };
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private url(path: string): string {
    return `${this.config.baseUrl.replace(/\/$/, '')}${path}`;
  }

  private headers(): Record<string, string> {
    return {
      apikey: this.config.apiKey,
      'Content-Type': 'application/json',
    };
  }

  private normalizeState(raw: string): EvolutionConnectionState['state'] {
    const s = raw.toLowerCase();
    if (s === 'open') return 'open';
    if (s === 'close' || s === 'closed') return 'close';
    if (s === 'connecting') return 'connecting';
    if (s === 'refused') return 'refused';
    if (s === 'loggedout') return 'loggedOut';
    if (s === 'qr' || s.includes('qr')) return 'qr';
    return 'close';
  }

  /**
   * Extracts a phone number from a JID like `966501234567:123@s.whatsapp.net`.
   */
  private normalizePhoneFromJid(jid: string): string {
    const bare = jid.split('@')[0] ?? '';
    const numeric = bare.split(':')[0] ?? '';
    if (!numeric) return '';
    if (numeric.startsWith('+')) return numeric;
    return `+${numeric}`;
  }
}
