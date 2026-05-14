// SaaS-02g-sms — returned when provider=NONE or credentials missing. Throws on send.

import {
  SmsProviderNotConfiguredError,
  type DlrPayload,
  type ParsedDlr,
  type SmsProvider,
  type SmsSendResult,
} from './sms-provider.interface';

export class NoOpAdapter implements SmsProvider {
  readonly name = 'NONE' as const;

  async send(): Promise<SmsSendResult> {
    throw new SmsProviderNotConfiguredError();
  }

  verifyDlrSignature(_payload: DlrPayload, _webhookSecret: string): void {
    throw new SmsProviderNotConfiguredError();
  }

  parseDlr(_rawBody: string): ParsedDlr {
    throw new SmsProviderNotConfiguredError();
  }
}
