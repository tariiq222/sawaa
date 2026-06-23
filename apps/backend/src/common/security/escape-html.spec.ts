import { escapeHtml } from './escape-html';

describe('escapeHtml', () => {
  it('escapes all five HTML-significant characters', () => {
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });

  it('neutralises a script-tag payload', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
  });

  it('escapes ampersands first so entities are not double-escaped', () => {
    // `<` -> `&lt;`; the `&` in `&lt;` must NOT become `&amp;lt;`.
    expect(escapeHtml('<')).toBe('&lt;');
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('leaves plain text (including Arabic) untouched', () => {
    expect(escapeHtml('مرحباً أحمد')).toBe('مرحباً أحمد');
    expect(escapeHtml('')).toBe('');
  });
});
