import { bilingualLayout, escapeHtml, BRAND } from './shared';

export interface OtpLoginVars {
  code: string;
  expiresInMinutes: number;
}

export function otpLoginTemplate(vars: OtpLoginVars): {
  subjectAr: string;
  subjectEn: string;
  html: string;
} {
  const code = escapeHtml(vars.code);
  const mins = Math.max(1, Math.floor(vars.expiresInMinutes));

  const codeBlock = `
    <div style="background:${BRAND.surface};border-radius:12px;padding:24px;margin:24px 0;text-align:center;">
      <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:${BRAND.primary};font-family:monospace;">${code}</span>
    </div>
  `;

  const ar = `
    <h1 style="color:${BRAND.primary};font-size:20px;margin:0 0 12px;">رمز تسجيل الدخول</h1>
    <p style="color:${BRAND.textBody};font-size:15px;">استخدم الرمز التالي لإكمال تسجيل الدخول:</p>
    ${codeBlock}
    <p style="color:${BRAND.textMuted};font-size:13px;">سينتهي الرمز خلال ${mins} دقيقة.</p>
  `;
  const en = `
    <h1 style="color:${BRAND.primary};font-size:20px;margin:0 0 12px;">Your login code</h1>
    <p style="color:${BRAND.textBody};font-size:15px;">Use the code below to finish signing in:</p>
    ${codeBlock}
    <p style="color:${BRAND.textMuted};font-size:13px;">This code expires in ${mins} minute${mins === 1 ? '' : 's'}.</p>
  `;

  return {
    subjectAr: 'رمز تسجيل الدخول إلى Deqah',
    subjectEn: 'Your Deqah login code',
    html: bilingualLayout({ ar, en }),
  };
}
