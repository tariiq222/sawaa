import { bilingualLayout, escapeHtml, BRAND } from './shared';

export interface FeatureGraceWarningVars {
  ownerName: string;
  orgName: string;
  featureKey: string;
  featureNameAr: string;
  featureNameEn: string;
  daysLeft: number;
}

export function featureGraceWarningTemplate(vars: FeatureGraceWarningVars): {
  subjectAr: string;
  subjectEn: string;
  html: string;
} {
  const name = escapeHtml(vars.ownerName);
  const org = escapeHtml(vars.orgName);
  const featureAr = escapeHtml(vars.featureNameAr);
  const featureEn = escapeHtml(vars.featureNameEn);
  const days = Math.max(0, Math.floor(vars.daysLeft));
  const daysWordAr = days === 1 ? 'يوم' : 'أيام';
  const daysWordEn = days === 1 ? 'day' : 'days';

  const ar = `
    <h1 style="color:${BRAND.primary};font-size:20px;margin:0 0 12px;">${name}، تنبيه: فترة السماح على وشك الانتهاء</h1>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      ميزة <strong>${featureAr}</strong> في حساب "${org}" ستتوقف خلال <strong>${days} ${daysWordAr}</strong>.
      لمواصلة استخدامها، يرجى ترقية باقتك.
    </p>
    <p style="color:${BRAND.textMuted};font-size:13px;">رمز الميزة: ${escapeHtml(vars.featureKey)}</p>
  `;
  const en = `
    <h1 style="color:${BRAND.primary};font-size:20px;margin:0 0 12px;">${name}, grace period ending soon</h1>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      The <strong>${featureEn}</strong> feature for "${org}" will be disabled in <strong>${days} ${daysWordEn}</strong>.
      Upgrade your plan to keep access.
    </p>
    <p style="color:${BRAND.textMuted};font-size:13px;">Feature: ${escapeHtml(vars.featureKey)}</p>
  `;

  return {
    subjectAr: `تنبيه: ميزة ${featureAr} ستنتهي خلال ${days} ${daysWordAr}`,
    subjectEn: `Warning: ${featureEn} grace period ends in ${days} ${daysWordEn}`,
    html: bilingualLayout({ ar, en }),
  };
}
