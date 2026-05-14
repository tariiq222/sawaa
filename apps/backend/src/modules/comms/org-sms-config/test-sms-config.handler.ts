// SaaS-02g-sms — send a test SMS via the tenant's persisted provider config.
// Updates lastTestAt / lastTestOk on the row. Returns bilingual errors.

import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { SmsProviderFactory } from '../../../infrastructure/sms/sms-provider.factory';
import type { TestSmsConfigDto } from './test-sms-config.dto';
import { DEFAULT_ORG_ID } from '../../../common/constants';

export type TestSmsConfigCommand = TestSmsConfigDto;

export type TestSmsConfigResult = {
  ok: boolean;
  providerMessageId?: string;
  error?: { ar: string; en: string };
};

@Injectable()
export class TestSmsConfigHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly factory: SmsProviderFactory,
  ) {}

  async execute(cmd: TestSmsConfigCommand): Promise<TestSmsConfigResult> {
    const cfg = await this.prisma.organizationSmsConfig.findFirst();
    if (!cfg || cfg.provider === 'NONE' || !cfg.credentialsCiphertext) {
      throw new BadRequestException({
        ar: 'مزود الرسائل غير مُكوَّن. احفظ بيانات الاعتماد أولاً.',
        en: 'SMS provider not configured. Save credentials first.',
      });
    }

    // organizationId kept as AES-GCM AAD for credential decryption
    const adapter = await this.factory.forCurrentTenant(DEFAULT_ORG_ID);
    try {
      const result = await adapter.send(
        cmd.toPhone,
        'Sawaa test message — رسالة اختبار',
        cfg.senderId ?? null,
      );
      await this.prisma.organizationSmsConfig.update({
        where: { id: cfg.id },
        data: { lastTestAt: new Date(), lastTestOk: true },
      });
      return { ok: true, providerMessageId: result.providerMessageId };
    } catch (err) {
      await this.prisma.organizationSmsConfig.update({
        where: { id: cfg.id },
        data: { lastTestAt: new Date(), lastTestOk: false },
      });
      const message =
        err instanceof Error ? err.message : 'Unknown error';
      return {
        ok: false,
        error: {
          ar: `فشل إرسال رسالة الاختبار: ${message}`,
          en: `Failed to send test SMS: ${message}`,
        },
      };
    }
  }
}
