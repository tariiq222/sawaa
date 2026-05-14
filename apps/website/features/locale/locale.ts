import { cookies } from 'next/headers';

export type Locale = 'ar' | 'en';

const COOKIE_KEY = 'deqah-locale';

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const raw = store.get(COOKIE_KEY)?.value;
  return raw === 'en' ? 'en' : 'ar';
}

export function localeDir(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}
