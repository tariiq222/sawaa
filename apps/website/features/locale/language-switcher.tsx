'use client';

import { useRouter } from 'next/navigation';
import type { Locale } from './locale';
import { useT } from './locale-provider';

interface Props {
  current: Locale;
}

function persistLocale(next: Locale) {
  document.cookie = `sawaa-locale=${next}; path=/; max-age=${60 * 60 * 24 * 365}`;
}

export function LanguageSwitcher({ current }: Props) {
  const router = useRouter();
  const t = useT();

  const switchTo = (next: Locale) => {
    if (next === current) return;
    persistLocale(next);
    // eslint-disable-next-line react-hooks/immutability
    document.documentElement.lang = next;
    // eslint-disable-next-line react-hooks/immutability
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
    router.refresh();
  };

  const options: { value: Locale; label: string }[] = [
    { value: 'ar', label: t('locale.switchToArabic') },
    { value: 'en', label: t('locale.switchToEnglish') },
  ];

  return (
    <div
      role="group"
      aria-label={t('locale.label')}
      className="inline-flex items-center rounded-full p-0.5"
      style={{ background: 'var(--sw-primary-50)' }}
    >
      {options.map((o) => {
        const active = o.value === current;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => switchTo(o.value)}
            aria-pressed={active}
            className="px-2.5 py-1 text-[0.75rem] font-bold rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sw-primary-500)]"
            style={{
              background: active ? 'var(--sw-primary-500)' : 'transparent',
              color: active ? '#fff' : 'var(--sw-primary-700)',
            }}
          >
            {o.value === 'ar' ? 'ع' : 'EN'}
          </button>
        );
      })}
    </div>
  );
}
