import { BRAND, escapeHtml, bilingualLayout } from './shared';

describe('shared', () => {
  it('BRAND should be defined', () => {
    expect(BRAND).toBeDefined();
  });

  it('escapeHtml escapes special chars', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('bilingualLayout generates HTML', () => {
    const html = bilingualLayout({ ar: 'مرحبا', en: 'Hello' });
    expect(html).toContain('مرحبا');
    expect(html).toContain('Hello');
  });
});
