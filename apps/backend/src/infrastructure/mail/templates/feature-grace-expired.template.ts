import { bilingualLayout, escapeHtml, BRAND } from './shared';

export interface FeatureGraceExpiredVars {
  ownerName: string;
  orgName: string;
  featureKey: string;
  featureNameAr: string;
  featureNameEn: string;
}

export function featureGraceExpiredTemplate(vars: FeatureGraceExpiredVars): {
  subjectAr: string;
  subjectEn: string;
  html: string;
} {
  const name = escapeHtml(vars.ownerName);
  const org = escapeHtml(vars.orgName);
  const featureAr = escapeHtml(vars.featureNameAr);
  const featureEn = escapeHtml(vars.featureNameEn);

  const ar = `
    <h1 style="color:${BRAND.primary};font-size:20px;margin:0 0 12px;">${name}، انتهت فترة السماح</h1>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      ميزة <strong>${featureAr}</strong> في حساب "${org}" لم تعد متاحة بعد انتهاء فترة السماح.
      قم بترقية باقتك لاستعادة الوصول.
    </p>
    <p style="color:${BRAND.textMuted};font-size:13px;">رمز الميزة: ${escapeHtml(vars.featureKey)}</p>
  `;
  const en = `
    <h1 style="color:${BRAND.primary};font-size:20px;margin:0 0 12px;">${name}, grace period expired</h1>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      The <strong>${featureEn}</strong> feature for "${org}" has been disabled — your grace period has ended.
      Upgrade your plan to regain access.
    </p>
    <p style="color:${BRAND.textMuted};font-size:13px;">Feature: ${escapeHtml(vars.featureKey)}</p>
  `;

  return {
    subjectAr: `ميزة ${featureAr} — انتهت فترة السماح`,
    subjectEn: `${featureEn} — grace period expired`,
    html: bilingualLayout({ ar, en }),
  };
}
