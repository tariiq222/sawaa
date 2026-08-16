'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  Brain,
  Briefcase,
  ClipboardList,
  Clock3,
  Heart,
  Lightbulb,
  ListChecks,
  MapPin,
  MonitorPlay,
  RefreshCw,
  Smile,
  Sparkles,
  Sprout,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react';

import type { BookableService } from '@/features/public-catalog/public';
import { useLocale, useT } from '@/features/locale/locale-provider';
import { safeImageSrc } from '@/lib/image-url';
import { grossWithVat, halalasToSarNumber } from '@/lib/money';

const ICONS: Record<string, LucideIcon> = {
  Analytics01Icon: ClipboardList,
  Briefcase01Icon: Briefcase,
  FavouriteIcon: Heart,
  Plant02Icon: Sprout,
  RefreshIcon: RefreshCw,
  SmileIcon: Smile,
  Target01Icon: Target,
  UserGroupIcon: Users,
  Brain,
  ClipboardList,
  Heart,
  Lightbulb,
  ListChecks,
  RefreshCw,
  Smile,
  Sparkles,
  Sprout,
  Target,
  Users,
};

interface ServiceCardProps {
  item: BookableService;
  vatRate?: number;
  className?: string;
}

function ServiceIcon({
  iconName,
  name,
  accent,
}: {
  iconName: string | null | undefined;
  name: string;
  accent: string;
}) {
  const normalized = name.toLocaleLowerCase('ar');
  const Icon =
    (iconName && ICONS[iconName]) ||
    (normalized.includes('ذكاء') || normalized.includes('intelligence')
      ? Lightbulb
      : normalized.includes('mmpi') || normalized.includes('الشخصية')
        ? ClipboardList
        : normalized.includes('مقاييس') || normalized.includes('scales')
          ? ListChecks
          : normalized.includes('العقلية') || normalized.includes('mental')
            ? Brain
            : Sparkles);

  return <Icon aria-hidden className="h-14 w-14" strokeWidth={1.45} style={{ color: accent }} />;
}

export function ServiceCard({ item, vatRate = 0, className = '' }: ServiceCardProps) {
  const locale = useLocale();
  const t = useT();
  const isAr = locale === 'ar';
  const { service } = item;
  const name = isAr ? service.nameAr : service.nameEn?.trim() || service.nameAr;
  const description = isAr
    ? service.descriptionAr
    : service.descriptionEn?.trim() || service.descriptionAr;
  const categoryName = isAr
    ? item.categoryNameAr
    : item.categoryNameEn?.trim() || item.categoryNameAr;
  const image = safeImageSrc(service.imageUrl ?? item.categoryImageUrl);
  const iconName = service.iconName ?? item.categoryIconName;
  const accent = service.iconBgColor ?? item.categoryIconBgColor ?? 'var(--sw-primary-600)';
  const price = Intl.NumberFormat(isAr ? 'ar-SA' : 'en-US', {
    maximumFractionDigits: 2,
  }).format(halalasToSarNumber(grossWithVat(Number(service.price), vatRate)));
  const practitionerLabel = `${item.practitionerCount} ${
    item.practitionerCount === 1 ? t('services.specialist') : t('services.specialists')
  }`;

  return (
    <article
      className={`group flex h-full flex-col overflow-hidden rounded-2xl bg-white p-4 transition-all duration-300 hover:-translate-y-1 ${className}`}
      style={{
        border: '1px solid var(--sw-neutral-100)',
        boxShadow: 'var(--sw-shadow-xs)',
      }}
    >
      <div
        className="relative mb-4 flex h-[160px] w-full items-center justify-center overflow-hidden rounded-xl"
        style={{
          background: image
            ? undefined
            : `linear-gradient(135deg, color-mix(in srgb, ${accent} 14%, white), color-mix(in srgb, ${accent} 5%, white))`,
          boxShadow: `0 0 0 1px color-mix(in srgb, ${accent} 18%, transparent)`,
        }}
      >
        {image ? (
          <Image
            src={image}
            alt={name}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 768px) 86vw, 320px"
          />
        ) : (
          <ServiceIcon iconName={iconName} name={name} accent={accent} />
        )}
        <span
          className="absolute end-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[0.65rem] font-extrabold backdrop-blur"
          style={{ color: 'var(--sw-primary-700)' }}
        >
          {t('services.cardBadge')}
        </span>
      </div>

      <div className="flex flex-1 flex-col">
        <span className="mb-2 text-[0.7rem] font-bold" style={{ color: accent }}>
          {categoryName}
        </span>
        <h3 className="mb-2 text-lg font-extrabold leading-snug" style={{ color: 'var(--sw-secondary-700)' }}>
          {name}
        </h3>
        <p
          className="mb-4 line-clamp-3 min-h-[3.9rem] text-[0.8rem] leading-relaxed"
          style={{ color: 'var(--sw-neutral-600)' }}
        >
          {description}
        </p>

        <div
          className="mb-4 grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl px-3 py-2.5 text-[0.7rem] font-semibold"
          style={{
            background: 'color-mix(in srgb, var(--sw-primary-50) 65%, white)',
            color: 'var(--sw-neutral-600)',
          }}
        >
          {service.showDuration !== false && service.durationMins > 0 ? (
            <Fact icon={Clock3} text={`${service.durationMins} ${t('services.duration')}`} />
          ) : null}
          {service.showPrice !== false ? (
            <Fact icon={Sparkles} text={price} suffix={t('booking.summary.currency')} />
          ) : null}
          {item.deliveryTypes.map((type) => (
            <Fact
              key={type}
              icon={type === 'ONLINE' ? MonitorPlay : MapPin}
              text={type === 'ONLINE' ? t('services.online') : t('services.inPerson')}
            />
          ))}
          <Fact icon={Users} text={practitionerLabel} />
        </div>

        <Link
          href={`/booking?serviceId=${encodeURIComponent(service.id)}`}
          aria-label={`${t('services.bookAria')} ${name}`}
          className="mt-auto inline-flex items-center justify-between rounded-full px-4 py-2.5 text-[0.78rem] font-extrabold transition-all hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sw-primary-500)] focus-visible:ring-offset-2"
          style={{ background: 'var(--sw-primary-700)', color: '#fff' }}
        >
          {t('services.bookCta')}
          <ArrowLeft aria-hidden className="h-3.5 w-3.5 rtl:rotate-180" />
        </Link>
      </div>
    </article>
  );
}

function Fact({
  icon: Icon,
  text,
  suffix,
}: {
  icon: LucideIcon;
  text: string;
  suffix?: string;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Icon aria-hidden className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--sw-primary-600)' }} />
      <span className="truncate tabular-nums">{text}</span>
      {suffix ? <span className="text-[0.62rem]">{suffix}</span> : null}
    </span>
  );
}
