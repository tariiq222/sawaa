/**
 * Branding sanitizers — defends against XSS / CSS injection from tenant-provided
 * customCss, fontUrl, logoUrl, faviconUrl. Tenant-controlled strings are echoed
 * to other clients (per-tenant theming), so they must be validated server-side.
 */

const ALLOWED_ASSET_PROTOCOLS = new Set(['http:', 'https:']);

// Hosts allowed for tenant-provided URLs (logo, favicon, font).
// Defaults to MinIO + dashboard host; configurable via env.
function parseHostList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

export function getAllowedAssetHosts(env: NodeJS.ProcessEnv = process.env): string[] {
  const explicit = parseHostList(env.BRANDING_ALLOWED_ASSET_HOSTS);
  if (explicit.length > 0) return explicit;
  const minio = env.MINIO_ENDPOINT ? [env.MINIO_ENDPOINT.toLowerCase()] : [];
  return minio;
}

export function getAllowedFontHosts(env: NodeJS.ProcessEnv = process.env): string[] {
  const explicit = parseHostList(env.BRANDING_ALLOWED_FONT_HOSTS);
  if (explicit.length > 0) return explicit;
  return getAllowedAssetHosts(env);
}

export type UrlValidationResult = { ok: true } | { ok: false; reason: string };

export function validateAssetUrl(
  raw: string,
  allowedHosts: string[],
): UrlValidationResult {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: 'invalid URL' };
  }
  if (!ALLOWED_ASSET_PROTOCOLS.has(parsed.protocol)) {
    return { ok: false, reason: `protocol ${parsed.protocol} not allowed` };
  }
  if (allowedHosts.length === 0) {
    return { ok: false, reason: 'no allowed hosts configured' };
  }
  const host = parsed.hostname.toLowerCase();
  const matches = allowedHosts.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`),
  );
  if (!matches) {
    return { ok: false, reason: `host ${host} not in allowlist` };
  }
  return { ok: true };
}

/**
 * customCss sanitizer — defensive subset of CSS, declarations only.
 *
 * Strategy: reject anything that smells dangerous, then keep the input
 * verbatim. We do NOT attempt to parse arbitrary CSS — instead we forbid
 * constructs that enable exfiltration / script execution / layout takeover:
 *   - @import / @charset / @namespace (cross-origin fetches, parser hijack)
 *   - url(...) with non-data, non-allowed hosts (exfil via background-image)
 *   - expression(...) (legacy IE script injection)
 *   - javascript:, vbscript:, data:text/html (script vectors)
 *   - </style>, <script (HTML break-out)
 *   - behavior: (legacy IE)
 *
 * Soft cap of 10KB — branding overrides are tweaks, not stylesheets.
 */

const CUSTOM_CSS_MAX_BYTES = 10 * 1024;

const FORBIDDEN_PATTERNS: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  { pattern: /<\s*\/?\s*(style|script|iframe|object|embed|link)\b/i, reason: 'HTML tags not allowed' },
  { pattern: /@import\b/i, reason: '@import not allowed' },
  { pattern: /@charset\b/i, reason: '@charset not allowed' },
  { pattern: /@namespace\b/i, reason: '@namespace not allowed' },
  { pattern: /\bexpression\s*\(/i, reason: 'expression() not allowed' },
  { pattern: /\bbehavior\s*:/i, reason: 'behavior property not allowed' },
  { pattern: /javascript\s*:/i, reason: 'javascript: URLs not allowed' },
  { pattern: /vbscript\s*:/i, reason: 'vbscript: URLs not allowed' },
  { pattern: /data\s*:\s*text\s*\/\s*html/i, reason: 'data:text/html not allowed' },
];

export function sanitizeCustomCss(
  raw: string,
  allowedHosts: string[] = getAllowedAssetHosts(),
): UrlValidationResult {
  if (Buffer.byteLength(raw, 'utf8') > CUSTOM_CSS_MAX_BYTES) {
    return { ok: false, reason: `customCss exceeds ${CUSTOM_CSS_MAX_BYTES} bytes` };
  }

  for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
    if (pattern.test(raw)) return { ok: false, reason };
  }

  // Validate every url(...) reference — only data:image/* or allowed hosts.
  const urlPattern = /url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi;
  let match: RegExpExecArray | null;
  while ((match = urlPattern.exec(raw)) !== null) {
    const target = match[2].trim();
    if (/^data:image\/(png|jpeg|jpg|webp|svg\+xml|gif);/i.test(target)) continue;
    const result = validateAssetUrl(target, allowedHosts);
    if (!result.ok) {
      return { ok: false, reason: `url(${target}): ${result.reason}` };
    }
  }

  return { ok: true };
}

export const BRANDING_SANITIZER_LIMITS = {
  CUSTOM_CSS_MAX_BYTES,
};
