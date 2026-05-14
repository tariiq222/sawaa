import { bilingualLayout, escapeHtml, BRAND } from './shared';

export interface TrialExpiredVars {
  ownerName: string;
  orgName: string;
  upgradeUrl: string;
}

export function trialExpiredTemplate(vars: TrialExpiredVars): {
  subjectAr: string;
  subjectEn: string;
  html: string;
} {
  const name = escapeHtml(vars.ownerName);
  const org = escapeHtml(vars.orgName);
  const url = escapeHtml(vars.upgradeUrl);

  const ar = `
    <h1 style="color:${BRAND.primary};font-size:20px;margin:0 0 12px;">${name}، انتهت التجربة</h1>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      انتهت التجربة المجانية لـ "${org}". اختر باقة الآن لاستعادة الوصول.
    </p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:${BRAND.primary};color:#fff;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;">اختيار باقة</a>
    </p>
  `;
  const en = `
    <h1 style="color:${BRAND.primary};font-size:20px;margin:0 0 12px;">${name}, your trial has ended</h1>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      The free trial for "${org}" has expired. Pick a plan to restore access.
    </p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:${BRAND.primary};color:#fff;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;">Choose a plan</a>
    </p>
  `;

  return {
    subjectAr: 'انتهت تجربة Deqah',
    subjectEn: 'Your Deqah trial has ended',
    html: bilingualLayout({ ar, en }),
  };
}
