// SaaS-02g-sms — shared SMS provider contract.

export type SmsProviderName = 'UNIFONIC' | 'TAQNYAT' | 'NONE';

export type SmsSendResult = {
  providerMessageId: string;
  status: 'SENT' | 'QUEUED';
};

export type ParsedDlr = {
  providerMessageId: string;
  status: 'DELIVERED' | 'FAILED';
  errorCode?: string;
  errorMessage?: string;
};

export type DlrPayload = ParsedDlr & {
  rawBody: string;
  signature: string;
};

export interface SmsProvider {
  readonly name: SmsProviderName;
  send(
    to: string,
    body: string,
    senderId: string | null,
  ): Promise<SmsSendResult>;
  /** Throws on signature mismatch. */
  verifyDlrSignature(payload: DlrPayload, webhookSecret: string): void;
  parseDlr(rawBody: string): ParsedDlr;
}

export class SmsProviderNotConfiguredError extends Error {
  constructor() {
    super('SMS provider not configured for this organization');
    this.name = 'SmsProviderNotConfiguredError';
  }
}
