export const BRAND = {
  primary: '#354FD8',
  accent: '#82CC17',
  textBody: '#333333',
  textMuted: '#888888',
  surface: '#F5F7FA',
  fontFamily: "'IBM Plex Sans Arabic', Arial, sans-serif",
} as const;

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export interface BilingualSections {
  ar: string;
  en: string;
}

export function bilingualLayout({ ar, en }: BilingualSections): string {
  return `<!DOCTYPE html>
<html lang="ar">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Deqah</title>
</head>
<body style="margin:0;padding:24px;background:${BRAND.surface};font-family:${BRAND.fontFamily};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
<tr><td dir="rtl" style="padding:32px 28px;">${ar}</td></tr>
<tr><td style="border-top:1px solid #eee;"></td></tr>
<tr><td dir="ltr" style="padding:32px 28px;">${en}</td></tr>
</table>
</body>
</html>`;
}
