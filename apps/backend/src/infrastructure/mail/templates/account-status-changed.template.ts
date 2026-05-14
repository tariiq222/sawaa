import { bilingualLayout, escapeHtml, BRAND } from './shared';

export type AccountStatusKind = 'SUSPENDED' | 'REINSTATED';

export interface AccountStatusChangedVars {
  ownerName: string;
  orgName: string;
  status: AccountStatusKind;
  reason?: string;
  contactUrl?: string;
}

export function accountStatusChangedTemplate(vars: AccountStatusChangedVars): {
  subjectAr: string;
  subjectEn: string;
  html: string;
} {
  const name = escapeHtml(vars.ownerName);
  const org = escapeHtml(vars.orgName);
  const url = vars.contactUrl ? escapeHtml(vars.contactUrl) : '#';
  const reason = vars.reason ? escapeHtml(vars.reason) : null;

  if (vars.status === 'SUSPENDED') {
    const ar = `
      <h1 style="color:#B91C1C;font-size:20px;margin:0 0 12px;">${name}، تم تعليق الحساب</h1>
      <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
        تم تعليق حساب "${org}". ${reason ? `السبب: ${reason}.` : ''}
      </p>
      <p style="text-align:center;margin:28px 0;">
        <a href="${url}" style="display:inline-block;background:${BRAND.primary};color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600;">التواصل مع الدعم</a>
      </p>
    `;
    const en = `
      <h1 style="color:#B91C1C;font-size:20px;margin:0 0 12px;">${name}, your account was suspended</h1>
      <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
        Account "${org}" has been suspended. ${reason ? `Reason: ${reason}.` : ''}
      </p>
      <p style="text-align:center;margin:28px 0;">
        <a href="${url}" style="display:inline-block;background:${BRAND.primary};color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600;">Contact support</a>
      </p>
    `;
    return {
      subjectAr: 'تم تعليق حساب Deqah',
      subjectEn: 'Your Deqah account was suspended',
      html: bilingualLayout({ ar, en }),
    };
  }

  // REINSTATED
  const ar = `
    <h1 style="color:${BRAND.primary};font-size:20px;margin:0 0 12px;">${name}، تم إعادة تفعيل الحساب</h1>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      تم إعادة تفعيل حساب "${org}". مرحبًا بعودتك.
    </p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:${BRAND.primary};color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600;">افتح لوحة التحكم</a>
    </p>
  `;
  const en = `
    <h1 style="color:${BRAND.primary};font-size:20px;margin:0 0 12px;">${name}, your account was reinstated</h1>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      "${org}" is active again. Welcome back.
    </p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:${BRAND.primary};color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600;">Open Dashboard</a>
    </p>
  `;
  return {
    subjectAr: 'تم إعادة تفعيل حساب Deqah',
    subjectEn: 'Your Deqah account was reinstated',
    html: bilingualLayout({ ar, en }),
  };
}
