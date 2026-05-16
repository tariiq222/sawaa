'use client';

import { createContext, useContext } from 'react';
import type { Locale } from './locale';
import { t as translate, type MessageKey } from './dictionary';

const LocaleContext = createContext<Locale>('ar');

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useT() {
  const locale = useContext(LocaleContext);
  return (key: MessageKey) => translate(locale, key);
}
