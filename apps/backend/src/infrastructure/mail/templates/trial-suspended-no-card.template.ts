import { bilingualLayout, escapeHtml, BRAND } from './shared';

export interface TrialSuspendedNoCardVars {
  ownerName: string;
  orgName: string;
  billingUrl: string;
}

export function trialSuspendedNoCardTemplate(vars: TrialSuspendedNoCardVars): {
  subjectAr: string;
  subjectEn: string;
  html: string;
} {
  const name = escapeHtml(vars.ownerName);
  const org = escapeHtml(vars.orgName);
  const url = escapeHtml(vars.billingUrl);

  const ar = `
    <h1 style="color:${BRAND.primary};font-size:20px;margin:0 0 12px;">${name}، تم إيقاف التجربة مؤقتاً</h1>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      انتهت تجربة "${org}" ولم نجد بطاقة دفع محفوظة للتحويل إلى اشتراك مدفوع. أضف بطاقة من صفحة الفوترة لاستعادة الوصول.
    </p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:${BRAND.primary};color:#fff;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;">فتح الفوترة</a>
    </p>
  `;
  const en = `
    <h1 style="color:${BRAND.primary};font-size:20px;margin:0 0 12px;">${name}, your trial is suspended</h1>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      The trial for "${org}" ended without a saved payment card. Add a card from billing to restore access.
    </p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:${BRAND.primary};color:#fff;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;">Open billing</a>
    </p>
  `;

  return {
    subjectAr: 'تجربة Deqah موقوفة بانتظار بطاقة دفع',
    subjectEn: 'Your Deqah trial is suspended until a card is added',
    html: bilingualLayout({ ar, en }),
  };
}
