import { bilingualLayout, escapeHtml, BRAND } from './shared';

export interface SubscriptionPaymentFailedVars {
  ownerName: string;
  orgName: string;
  amountSar: string;
  reason: string;
  billingUrl: string;
}

export function subscriptionPaymentFailedTemplate(
  vars: SubscriptionPaymentFailedVars,
): { subjectAr: string; subjectEn: string; html: string } {
  const name = escapeHtml(vars.ownerName);
  const org = escapeHtml(vars.orgName);
  const amount = escapeHtml(vars.amountSar);
  const reason = escapeHtml(vars.reason);
  const url = escapeHtml(vars.billingUrl);

  const ar = `
    <h1 style="color:#B91C1C;font-size:20px;margin:0 0 12px;">${name}، تعذّرت عملية الدفع</h1>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      حاولنا خصم <strong>${amount} ⃁</strong> لاشتراك "${org}" ولم تنجح العملية.
      السبب: ${reason}.
    </p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:${BRAND.primary};color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600;">تحديث طريقة الدفع</a>
    </p>
  `;
  const en = `
    <h1 style="color:#B91C1C;font-size:20px;margin:0 0 12px;">${name}, payment failed</h1>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      We tried to charge <strong>${amount} ⃁</strong> for your "${org}" subscription and it didn't go through.
      Reason: ${reason}.
    </p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:${BRAND.primary};color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600;">Update payment method</a>
    </p>
  `;

  return {
    subjectAr: 'فشل دفع اشتراك Deqah',
    subjectEn: 'Deqah subscription payment failed',
    html: bilingualLayout({ ar, en }),
  };
}
