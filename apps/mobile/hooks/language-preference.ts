import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import i18n from '@/i18n';
import { DEFAULT_LANGUAGE, type SupportedLanguage } from '@/constants/config';

export const LANGUAGE_KEY = '@sawaa/language';

function supportedLanguage(value: string | null | undefined): SupportedLanguage {
  return value === 'en' || value === 'ar' ? value : DEFAULT_LANGUAGE;
}

export async function loadPreferredLanguage(): Promise<SupportedLanguage> {
  try {
    return supportedLanguage(await AsyncStorage.getItem(LANGUAGE_KEY));
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export function useLanguagePreference() {
  const [language, setLanguage] = useState<SupportedLanguage>(supportedLanguage(i18n.language));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const handleLanguageChange = (value: string) => setLanguage(supportedLanguage(value));
    i18n.on('languageChanged', handleLanguageChange);

    void loadPreferredLanguage().then(async (savedLanguage) => {
      await i18n.changeLanguage(savedLanguage);
      if (active) {
        setLanguage(savedLanguage);
        setReady(true);
      }
    });

    return () => {
      active = false;
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, []);

  return { language, ready };
}
