import { bilingualLayout, escapeHtml, BRAND } from './shared';

export interface TrialEndingVars {
  ownerName: string;
  orgName: string;
  daysLeft: number;
  upgradeUrl: string;
}

export function trialEndingTemplate(vars: TrialEndingVars): {
  subjectAr: string;
  subjectEn: string;
  html: string;
} {
  const name = escapeHtml(vars.ownerName);
  const org = escapeHtml(vars.orgName);
  const url = escapeHtml(vars.upgradeUrl);
  const days = Math.max(0, Math.floor(vars.daysLeft));

  const ar = `
    <h1 style="color:${BRAND.primary};font-size:20px;margin:0 0 12px;">${name}، تجربتك على وشك الانتهاء</h1>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      تبقّى ${days} ${days === 1 ? 'يوم' : 'أيام'} على انتهاء التجربة المجانية لحساب "${org}". اختر باقة لتستمر بدون انقطاع.
    </p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:${BRAND.primary};color:#fff;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;">اختيار باقة</a>
    </p>
  `;
  const en = `
    <h1 style="color:${BRAND.primary};font-size:20px;margin:0 0 12px;">${name}, your trial is ending soon</h1>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      You have ${days} day${days === 1 ? '' : 's'} left on your "${org}" free trial. Pick a plan to keep things running.
    </p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:${BRAND.primary};color:#fff;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;">Choose a plan</a>
    </p>
  `;

  return {
    subjectAr: `تجربة Deqah تنتهي خلال ${days} ${days === 1 ? 'يوم' : 'أيام'}`,
    subjectEn: `Your Deqah trial ends in ${days} day${days === 1 ? '' : 's'}`,
    html: bilingualLayout({ ar, en }),
  };
}
