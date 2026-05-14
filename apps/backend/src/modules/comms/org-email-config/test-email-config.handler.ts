// email-provider — send a test email via the tenant's persisted provider config.
// Updates lastTestAt / lastTestOk on the row. Returns bilingual errors.

import { BadRequestException, Injectable } from '@nestjs/common';
import { TenantContextService } from '../../../common/tenant';
import { PrismaService } from '../../../infrastructure/database';
import { EmailProviderFactory } from '../../../infrastructure/email/email-provider.factory';
import type { TestEmailConfigDto } from './test-email-config.dto';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export type TestEmailConfigCommand = TestEmailConfigDto;

export type TestEmailConfigResult = {
  ok: boolean;
  messageId?: string;
  error?: { ar: string; en: string };
};

@Injectable()
export class TestEmailConfigHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly factory: EmailProviderFactory,
  ) {}

  async execute(cmd: TestEmailConfigCommand): Promise<TestEmailConfigResult> {
    const organizationId = DEFAULT_ORGANIZATION_ID;

    const cfg = await this.prisma.organizationEmailConfig.findFirst({
      where: { organizationId },
    });

    if (!cfg || cfg.provider === 'NONE' || !cfg.credentialsCiphertext) {
      throw new BadRequestException({
        ar: 'مزود البريد غير مُكوَّن. احفظ بيانات الاعتماد أولاً.',
        en: 'Email provider not configured. Save credentials first.',
      });
    }

    const adapter = await this.factory.forCurrentTenant(organizationId);

    try {
      const result = await adapter.sendMail({
        to: cmd.toEmail,
        subject: 'Deqah test email — رسالة اختبار دقّة',
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; padding: 24px;">
            <h2 style="color: #354FD8;">تم الاتصال بمزود البريد بنجاح ✓</h2>
            <p>هذه رسالة اختبار من منصة دقّة للتحقق من إعداد مزود البريد الإلكتروني.</p>
            <hr/>
            <p style="direction: ltr; text-align: left;">
              <strong>Deqah Email Provider Test</strong><br/>
              This is a test message to verify your email provider configuration.
            </p>
          </div>
        `,
      });

      await this.prisma.organizationEmailConfig.update({
        where: { organizationId },
        data: { lastTestAt: new Date(), lastTestOk: true },
      });

      return { ok: true, messageId: result.messageId };
    } catch (err) {
      await this.prisma.organizationEmailConfig.update({
        where: { organizationId },
        data: { lastTestAt: new Date(), lastTestOk: false },
      });

      const message = err instanceof Error ? err.message : 'Unknown error';
      return {
        ok: false,
        error: {
          ar: `فشل إرسال رسالة الاختبار: ${message}`,
          en: `Failed to send test email: ${message}`,
        },
      };
    }
  }
}
