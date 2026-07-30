import { cookies } from 'next/headers';
import type { Locale } from './dir';

export type { Locale } from './dir';
export { localeDir } from './dir';

const COOKIE_KEY = 'sawaa-locale';

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const raw = store.get(COOKIE_KEY)?.value;
  return raw === 'en' ? 'en' : 'ar';
}