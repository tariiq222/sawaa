import { bilingualLayout, escapeHtml, BRAND } from './shared';

export interface PlanChangedVars {
  ownerName: string;
  orgName: string;
  fromPlanName: string;
  toPlanName: string;
  effectiveDate: string;
}

export function planChangedTemplate(vars: PlanChangedVars): {
  subjectAr: string;
  subjectEn: string;
  html: string;
} {
  const name = escapeHtml(vars.ownerName);
  const org = escapeHtml(vars.orgName);
  const from = escapeHtml(vars.fromPlanName);
  const to = escapeHtml(vars.toPlanName);
  const date = escapeHtml(vars.effectiveDate.slice(0, 10));

  const ar = `
    <h1 style="color:${BRAND.primary};font-size:20px;margin:0 0 12px;">${name}، تم تحديث الباقة</h1>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      تم نقل اشتراك "${org}" من <strong>${from}</strong> إلى <strong>${to}</strong>، اعتبارًا من ${date}.
    </p>
  `;
  const en = `
    <h1 style="color:${BRAND.primary};font-size:20px;margin:0 0 12px;">${name}, your plan was updated</h1>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      Your "${org}" subscription moved from <strong>${from}</strong> to <strong>${to}</strong>, effective ${date}.
    </p>
  `;

  return {
    subjectAr: 'تم تحديث باقة اشتراك Deqah',
    subjectEn: 'Your Deqah plan changed',
    html: bilingualLayout({ ar, en }),
  };
}
