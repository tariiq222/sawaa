import { describe, it, expect } from 'vitest';
import { localeDir } from './locale';
import { t, dictionary } from './dictionary';

describe('localeDir', () => {
  it('returns rtl for ar', () => {
    expect(localeDir('ar')).toBe('rtl');
  });

  it('returns ltr for en', () => {
    expect(localeDir('en')).toBe('ltr');
  });
});

describe('dictionary', () => {
  it('returns the Arabic translation', () => {
    expect(t('ar', 'nav.home')).toBe('الرئيسية');
  });

  it('returns the English translation', () => {
    expect(t('en', 'nav.home')).toBe('Home');
  });

  it('covers every Arabic key with an English equivalent', () => {
    const arKeys = Object.keys(dictionary.ar).sort();
    const enKeys = Object.keys(dictionary.en).sort();
    expect(enKeys).toEqual(arKeys);
  });

  it('has no empty strings in either locale', () => {
    const hasEmpty = (loc: Record<string, string>) =>
      Object.values(loc).some((v) => v.trim().length === 0);
    expect(hasEmpty(dictionary.ar)).toBe(false);
    expect(hasEmpty(dictionary.en)).toBe(false);
  });
});
