import { bilingualLayout, escapeHtml, BRAND } from './shared';

export interface MembershipInvitationVars {
  /** Display name to greet (Membership.displayName, falls back to email local part). */
  recipientName: string;
  /** Inviting organization (Arabic name, primary). */
  orgNameAr: string;
  /** Inviting organization (English name, optional). */
  orgNameEn?: string;
  /** Absolute URL to /accept-invitation?token=... */
  acceptUrl: string;
  /** Short, human-readable expiry, e.g. "7 days". */
  expiresIn: string;
}

export function membershipInvitationTemplate(vars: MembershipInvitationVars): {
  subjectAr: string;
  subjectEn: string;
  html: string;
} {
  const recipient = escapeHtml(vars.recipientName);
  const orgAr = escapeHtml(vars.orgNameAr);
  const orgEn = escapeHtml(vars.orgNameEn ?? vars.orgNameAr);
  const url = escapeHtml(vars.acceptUrl);
  const expires = escapeHtml(vars.expiresIn);

  const ctaBlock = `
    <div style="text-align:center;margin:24px 0;">
      <a href="${url}" style="display:inline-block;background:${BRAND.primary};color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600;">
        قبول الدعوة · Accept invitation
      </a>
    </div>
    <p style="color:${BRAND.textMuted};font-size:13px;text-align:center;word-break:break-all;">
      ${url}
    </p>
  `;

  const ar = `
    <h1 style="color:${BRAND.primary};font-size:20px;margin:0 0 12px;">دعوة للانضمام إلى ${orgAr}</h1>
    <p style="color:${BRAND.textBody};font-size:15px;">مرحباً ${recipient}،</p>
    <p style="color:${BRAND.textBody};font-size:15px;">تمت دعوتك للانضمام إلى ${orgAr} على Deqah. اضغط زر القبول أدناه لاستكمال التفعيل.</p>
    ${ctaBlock}
    <p style="color:${BRAND.textMuted};font-size:13px;">تنتهي صلاحية هذه الدعوة خلال ${expires}.</p>
    <p style="color:${BRAND.textMuted};font-size:13px;">إذا لم تكن تتوقع هذه الدعوة، تجاهل هذه الرسالة.</p>
  `;
  const en = `
    <h1 style="color:${BRAND.primary};font-size:20px;margin:0 0 12px;">Invitation to join ${orgEn}</h1>
    <p style="color:${BRAND.textBody};font-size:15px;">Hi ${recipient},</p>
    <p style="color:${BRAND.textBody};font-size:15px;">You’ve been invited to join ${orgEn} on Deqah. Click the button below to accept and finish setup.</p>
    ${ctaBlock}
    <p style="color:${BRAND.textMuted};font-size:13px;">This invitation expires in ${expires}.</p>
    <p style="color:${BRAND.textMuted};font-size:13px;">If you weren’t expecting this, you can safely ignore this email.</p>
  `;

  return {
    subjectAr: `دعوة للانضمام إلى ${vars.orgNameAr}`,
    subjectEn: `You’re invited to join ${vars.orgNameEn ?? vars.orgNameAr} on Deqah`,
    html: bilingualLayout({ ar, en }),
  };
}
