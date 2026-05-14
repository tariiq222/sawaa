import {
  getAllowedAssetHosts,
  getAllowedFontHosts,
  sanitizeCustomCss,
  validateAssetUrl,
} from './branding-sanitizers';

describe('getAllowedAssetHosts', () => {
  it('uses BRANDING_ALLOWED_ASSET_HOSTS when present', () => {
    expect(
      getAllowedAssetHosts({ BRANDING_ALLOWED_ASSET_HOSTS: 'cdn.example.com, minio.local' } as any),
    ).toEqual(['cdn.example.com', 'minio.local']);
  });
  it('falls back to MINIO_ENDPOINT', () => {
    expect(getAllowedAssetHosts({ MINIO_ENDPOINT: 'localhost' } as any)).toEqual(['localhost']);
  });
  it('returns empty when nothing configured', () => {
    expect(getAllowedAssetHosts({} as any)).toEqual([]);
  });
});

describe('getAllowedFontHosts', () => {
  it('falls back to asset hosts when font hosts unset', () => {
    expect(getAllowedFontHosts({ MINIO_ENDPOINT: 'minio.local' } as any)).toEqual(['minio.local']);
  });
  it('uses BRANDING_ALLOWED_FONT_HOSTS when set', () => {
    expect(
      getAllowedFontHosts({ BRANDING_ALLOWED_FONT_HOSTS: 'fonts.example.com' } as any),
    ).toEqual(['fonts.example.com']);
  });
});

describe('validateAssetUrl', () => {
  const hosts = ['cdn.example.com', 'minio.local'];

  it('accepts allowed host', () => {
    expect(validateAssetUrl('https://cdn.example.com/logo.png', hosts).ok).toBe(true);
  });
  it('accepts subdomain of allowed host', () => {
    expect(validateAssetUrl('https://a.minio.local/x.png', hosts).ok).toBe(true);
  });
  it('rejects non-allowed host', () => {
    const r = validateAssetUrl('https://attacker.com/logo.png', hosts);
    expect(r.ok).toBe(false);
  });
  it('rejects javascript: protocol', () => {
    const r = validateAssetUrl('javascript:alert(1)', hosts);
    expect(r.ok).toBe(false);
  });
  it('rejects data: protocol for assets', () => {
    const r = validateAssetUrl('data:text/html,<script>', hosts);
    expect(r.ok).toBe(false);
  });
  it('rejects malformed URL', () => {
    expect(validateAssetUrl('not a url', hosts).ok).toBe(false);
  });
  it('rejects when no hosts configured', () => {
    expect(validateAssetUrl('https://cdn.example.com/x.png', []).ok).toBe(false);
  });
});

describe('sanitizeCustomCss', () => {
  const hosts = ['cdn.example.com'];

  it('accepts simple safe CSS', () => {
    expect(sanitizeCustomCss(':root { --radius: 8px; }', hosts).ok).toBe(true);
  });
  it('rejects @import', () => {
    expect(sanitizeCustomCss('@import url(https://cdn.example.com/a.css);', hosts).ok).toBe(false);
  });
  it('rejects HTML tags', () => {
    expect(sanitizeCustomCss('</style><script>alert(1)</script>', hosts).ok).toBe(false);
  });
  it('rejects expression()', () => {
    expect(sanitizeCustomCss('a { width: expression(alert(1)); }', hosts).ok).toBe(false);
  });
  it('rejects javascript: URL', () => {
    expect(sanitizeCustomCss('a { background: url(javascript:alert(1)); }', hosts).ok).toBe(false);
  });
  it('rejects url() pointing at non-allowed host', () => {
    const r = sanitizeCustomCss('a { background: url(https://evil.com/x.png); }', hosts);
    expect(r.ok).toBe(false);
  });
  it('accepts url() pointing at allowed host', () => {
    expect(
      sanitizeCustomCss('a { background: url(https://cdn.example.com/x.png); }', hosts).ok,
    ).toBe(true);
  });
  it('accepts data:image/png url', () => {
    expect(sanitizeCustomCss('a { background: url(data:image/png;base64,AAAA); }', hosts).ok).toBe(
      true,
    );
  });
  it('rejects oversized input', () => {
    const big = 'a{}'.repeat(5000);
    expect(sanitizeCustomCss(big, hosts).ok).toBe(false);
  });
  it('rejects @charset', () => {
    expect(sanitizeCustomCss('@charset "UTF-8"; a { color: red; }', hosts).ok).toBe(false);
  });
  it('rejects behavior:', () => {
    expect(sanitizeCustomCss('a { behavior: url(x.htc); }', hosts).ok).toBe(false);
  });
});
