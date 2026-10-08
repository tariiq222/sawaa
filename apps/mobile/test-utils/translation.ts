import { createInstance, type TOptions } from 'i18next';
import ar from '@/i18n/ar.json';
import en from '@/i18n/en.json';

const translations = createInstance();
void translations.init({ resources: { ar: { translation: ar }, en: { translation: en } }, lng: 'en', fallbackLng: 'en', initAsync: false, interpolation: { escapeValue: false } });

/** Real resources/interpolation for isolated screen tests without native initialization. */
export function translatedTestMessage(key: string, locale = 'en', options?: TOptions): string {
  const { context, ...rest } = options ?? {};
  return translations.getFixedT(locale)(key, { ...rest, ...(typeof context === 'string' ? { context } : {}) });
}
