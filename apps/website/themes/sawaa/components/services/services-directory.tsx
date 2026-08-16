'use client';

import { useMemo, useState } from 'react';

import type { BookableService } from '@/features/public-catalog/public';
import { useLocale, useT } from '@/features/locale/locale-provider';
import { ServiceCard } from './service-card';

interface ServicesDirectoryProps {
  services: BookableService[];
  vatRate?: number;
}

export function ServicesDirectory({ services, vatRate = 0 }: ServicesDirectoryProps) {
  const locale = useLocale();
  const t = useT();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const categories = useMemo(() => {
    const unique = new Map<string, { id: string; name: string }>();
    for (const item of services) {
      unique.set(item.categoryId, {
        id: item.categoryId,
        name:
          locale === 'en'
            ? item.categoryNameEn?.trim() || item.categoryNameAr
            : item.categoryNameAr,
      });
    }
    return Array.from(unique.values());
  }, [locale, services]);
  const visibleServices = activeCategory
    ? services.filter((item) => item.categoryId === activeCategory)
    : services;

  return (
    <>
      {categories.length > 1 ? (
        <div
          className="sw-no-scrollbar mb-8 flex gap-2 overflow-x-auto pb-2"
          role="group"
          aria-label={t('services.viewAll')}
        >
          <FilterButton
            active={activeCategory === null}
            label={t('booking.services.all')}
            onClick={() => setActiveCategory(null)}
          />
          {categories.map((category) => (
            <FilterButton
              key={category.id}
              active={activeCategory === category.id}
              label={category.name}
              onClick={() => setActiveCategory(category.id)}
            />
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {visibleServices.map((item) => (
          <ServiceCard key={item.service.id} item={item} vatRate={vatRate} />
        ))}
      </div>
    </>
  );
}

function FilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="shrink-0 rounded-full px-4 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sw-primary-500)] focus-visible:ring-offset-2"
      style={{
        background: active ? 'var(--sw-primary-700)' : '#fff',
        color: active ? '#fff' : 'var(--sw-secondary-700)',
        border: active ? '1px solid var(--sw-primary-700)' : '1px solid var(--sw-neutral-200)',
      }}
    >
      {label}
    </button>
  );
}
