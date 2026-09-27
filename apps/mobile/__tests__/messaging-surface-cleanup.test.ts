import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const mobileRoot = resolve(__dirname, '..');

describe('retired messaging surface cleanup', () => {
  it('does not expose retired messaging terms in translations', () => {
    for (const locale of ['ar', 'en']) {
      const translations = JSON.parse(
        readFileSync(resolve(mobileRoot, `i18n/${locale}.json`), 'utf8'),
      ) as Record<string, unknown>;
      expect(translations).not.toHaveProperty('whatsapp');
      expect((translations.tabs as Record<string, unknown>)).not.toHaveProperty('assistant');
    }
  });

  it('keeps the old tab deep link as a safe redirect', () => {
    const route = readFileSync(resolve(mobileRoot, 'app/(client)/(tabs)/chat.tsx'), 'utf8');
    expect(route).toContain('Redirect');
    expect(route).toContain('/(client)/(tabs)/home');
    expect(route).not.toContain('wa.me');
  });
});
