import { bilingualLayout, escapeHtml, BRAND } from './shared';

export interface TenantWelcomeVars {
  ownerName: string;
  orgName: string;
  dashboardUrl: string;
  generatedPassword?: string;
}

export function tenantWelcomeTemplate(vars: TenantWelcomeVars): {
  subjectAr: string;
  subjectEn: string;
  html: string;
} {
  const name = escapeHtml(vars.ownerName);
  const org = escapeHtml(vars.orgName);
  const url = escapeHtml(vars.dashboardUrl);

  const passwordBlockAr = vars.generatedPassword
    ? `<p style="color:${BRAND.textBody};font-size:14px;line-height:1.7;background:#f5f5f5;padding:12px 16px;border-radius:8px;margin-top:16px;">
        كلمة المرور المؤقتة: <code style="font-family:monospace;font-weight:700;">${escapeHtml(vars.generatedPassword)}</code>. يُرجى تسجيل الدخول وتغييرها فوراً.
      </p>`
    : '';

  const passwordBlockEn = vars.generatedPassword
    ? `<p style="color:${BRAND.textBody};font-size:14px;line-height:1.7;background:#f5f5f5;padding:12px 16px;border-radius:8px;margin-top:16px;">
        Temporary password: <code style="font-family:monospace;font-weight:700;">${escapeHtml(vars.generatedPassword)}</code>. Please sign in and change it immediately.
      </p>`
    : '';

  const ar = `
    <h1 style="color:${BRAND.primary};font-size:22px;margin:0 0 16px;">أهلاً ${name} 👋</h1>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      شكرًا لانضمامك إلى Deqah. حسابك "${org}" جاهز، ومدّة التجربة المجانية ١٤ يومًا.
    </p>
    ${passwordBlockAr}
    <p style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:${BRAND.primary};color:#fff;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;">افتح لوحة التحكم</a>
    </p>
  `;

  const en = `
    <h1 style="color:${BRAND.primary};font-size:22px;margin:0 0 16px;">Welcome, ${name} 👋</h1>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      Thanks for joining Deqah. Your "${org}" workspace is ready and your 14-day free trial has started.
    </p>
    ${passwordBlockEn}
    <p style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:${BRAND.primary};color:#fff;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;">Open Dashboard</a>
    </p>
  `;

  return {
    subjectAr: 'مرحبًا بك في Deqah',
    subjectEn: 'Welcome to Deqah',
    html: bilingualLayout({ ar, en }),
  };
}
