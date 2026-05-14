'use client';

import { useRouter } from 'next/navigation';
import type { Locale } from './locale';

interface Props {
  current: Locale;
}

export function LanguageSwitcher({ current }: Props) {
  const router = useRouter();

  const switchTo = (next: Locale) => {
    document.cookie = `deqah-locale=${next}; path=/; max-age=${60 * 60 * 24 * 365}`;
    router.refresh();
  };

  return (
    <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
      <button
        type="button"
        onClick={() => switchTo('ar')}
        style={{ opacity: current === 'ar' ? 1 : 0.5, fontWeight: current === 'ar' ? 700 : 400 }}
      >
        ع
      </button>
      <button
        type="button"
        onClick={() => switchTo('en')}
        style={{ opacity: current === 'en' ? 1 : 0.5, fontWeight: current === 'en' ? 700 : 400 }}
      >
        EN
      </button>
    </div>
  );
}
