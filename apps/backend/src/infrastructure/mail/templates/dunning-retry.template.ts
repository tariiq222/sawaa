import { bilingualLayout, escapeHtml, BRAND } from './shared';

export interface DunningRetryVars {
  ownerName: string;
  orgName: string;
  amountSar: string;
  attemptNumber: number;
  maxAttempts: number;
  reason: string;
  billingUrl: string;
}

export function dunningRetryTemplate(
  vars: DunningRetryVars,
): { subjectAr: string; subjectEn: string; html: string } {
  const name = escapeHtml(vars.ownerName);
  const org = escapeHtml(vars.orgName);
  const amount = escapeHtml(vars.amountSar);
  const attempt = escapeHtml(String(vars.attemptNumber));
  const max = escapeHtml(String(vars.maxAttempts));
  const reason = escapeHtml(vars.reason);
  const url = escapeHtml(vars.billingUrl);

  const ar = `
    <h1 style="color:#B91C1C;font-size:20px;margin:0 0 12px;">${name}، لم تنجح محاولة الدفع</h1>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      حاولنا إعادة خصم <strong>${amount} ⃁</strong> لاشتراك "${org}".
      هذه المحاولة رقم <strong>${attempt}</strong> من <strong>${max}</strong>.
      السبب: ${reason}.
    </p>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      يمكنك تحديث البطاقة أو إعادة المحاولة يدوياً من صفحة الفوترة.
    </p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:${BRAND.primary};color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600;">فتح الفوترة</a>
    </p>
  `;
  const en = `
    <h1 style="color:#B91C1C;font-size:20px;margin:0 0 12px;">${name}, payment retry failed</h1>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      We retried <strong>${amount} ⃁</strong> for your "${org}" subscription.
      This was attempt <strong>${attempt}</strong> of <strong>${max}</strong>.
      Reason: ${reason}.
    </p>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      You can update the card or retry manually from billing settings.
    </p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:${BRAND.primary};color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600;">Open billing</a>
    </p>
  `;

  return {
    subjectAr: 'فشلت محاولة دفع اشتراك Deqah',
    subjectEn: 'Deqah payment retry failed',
    html: bilingualLayout({ ar, en }),
  };
}
