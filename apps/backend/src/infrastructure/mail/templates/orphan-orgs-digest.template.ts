import { bilingualLayout, escapeHtml } from './shared';

export interface OrphanOrgsDigestVars {
  recipientName: string;
  orphans: Array<{ id: string; nameAr: string | null; nameEn: string | null }>;
  adminPanelUrl: string;
  generatedAt: Date;
}

export function orphanOrgsDigestTemplate(vars: OrphanOrgsDigestVars) {
  const safeRecipient = escapeHtml(vars.recipientName);
  const dateStr = vars.generatedAt.toLocaleDateString('en-US', { dateStyle: 'medium' });
  const orphanCount = vars.orphans.length;

  const list = vars.orphans
    .map((o) => {
      const ar = escapeHtml(o.nameAr ?? o.id);
      const en = escapeHtml(o.nameEn ?? o.id);
      const id = escapeHtml(o.id);
      return `<li><strong>${ar}</strong> / ${en} <code style="color:#888;">${id}</code></li>`;
    })
    .join('');

  const subjectAr = `${orphanCount} منظمة بدون مالك نشط`;
  const subjectEn = `${orphanCount} organizations without an active OWNER`;

  const ar = `
    <h2 style="margin:0 0 16px;">تقرير المنظمات بلا مالك</h2>
    <p>مرحباً ${safeRecipient}،</p>
    <p>تم اكتشاف <strong>${orphanCount}</strong> منظمة بدون مالك نشط بتاريخ ${dateStr}.</p>
    <ul>${list}</ul>
    <p><a href="${vars.adminPanelUrl}" style="background:#354FD8;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block;">فتح لوحة الإدارة</a></p>
  `;
  const en = `
    <h2 style="margin:0 0 16px;">Orphan organizations digest</h2>
    <p>Hello ${safeRecipient},</p>
    <p>Detected <strong>${orphanCount}</strong> organizations without an active OWNER on ${dateStr}.</p>
    <ul>${list}</ul>
    <p><a href="${vars.adminPanelUrl}" style="background:#354FD8;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block;">Open admin panel</a></p>
  `;

  return {
    subjectAr,
    subjectEn,
    html: bilingualLayout({ ar, en }),
  };
}
