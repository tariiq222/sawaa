import i18n from '@/i18n';

describe('Arabic plural rules', () => {
  it('uses the polyfilled Intl.PluralRules with Arabic categories', () => {
    expect(new Intl.PluralRules('ar').select(2)).toBe('two');
    expect(new Intl.PluralRules('ar').select(11)).toBe('many');
    expect(Intl.PluralRules.supportedLocalesOf(['ar', 'en'])).toEqual(['ar', 'en']);
  });

  it.each([
    [0, 'لا يوجد مختصون'],
    [1, 'مختص واحد'],
    [2, 'مختصان'],
    [5, '5 مختصين'],
    [11, '11 مختصًا'],
    [100, '100 مختص'],
  ])('renders clinics.therapistsCount for count %i', (count, expected) => {
    expect(i18n.t('clinics.therapistsCount', { count, lng: 'ar' })).toBe(expected);
  });
});
