import Link from 'next/link';
import {
  ArrowLeft,
  BadgeCheck,
  Users,
  Heart,
  HandHeart,
  Baby,
  Smile,
  Brain,
  ClipboardList,
  RefreshCw,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { getPublicCatalog } from '@/features/public-catalog/public';
import { listPublicEmployees } from '@/features/therapists/public';
import { getLocale } from '@/features/locale/public';
import { t as translate, type MessageKey } from '@/features/locale/dictionary';

const GROUP_DEPARTMENT_NAMES = ['جماعية', 'Groups'];

const ICON_MAP: Record<string, LucideIcon> = {
  Sparkles,
  Users,
  Heart,
  HandHeart,
  Baby,
  Smile,
  Brain,
  ClipboardList,
  RefreshCw,
};

function resolveIcon(name: string | null): LucideIcon {
  if (!name) return Users;
  return ICON_MAP[name] ?? Users;
}

interface GroupEntry {
  id: string;
  nameAr: string;
  nameEn: string | null;
  serviceCount: number;
  therapistCount: number;
}

export async function SawaaSupportGroupsPage() {
  const locale = await getLocale();
  const [catalog, therapists] = await Promise.all([
    getPublicCatalog().catch(() => ({ departments: [], categories: [], services: [] })),
    listPublicEmployees().catch(() => []),
  ]);
  const t = (key: MessageKey) => translate(locale, key);

  const groupDept = catalog.departments.find((d) => GROUP_DEPARTMENT_NAMES.includes(d.nameAr));
  const groups: GroupEntry[] = groupDept
    ? catalog.categories
        .filter((c) => c.departmentId === groupDept.id && c.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((c) => {
          const categoryServiceIds = new Set(
            catalog.services.filter((s) => s.categoryId === c.id).map((s) => s.id),
          );
          const therapistCount = therapists.filter((th) =>
            th.serviceIds.some((id) => categoryServiceIds.has(id)),
          ).length;
          return {
            id: c.id,
            nameAr: c.nameAr,
            nameEn: c.nameEn,
            serviceCount: categoryServiceIds.size,
            therapistCount,
          };
        })
        .filter((c) => c.serviceCount > 0)
    : [];

  const total = groups.length;
  const totalServices = groups.reduce((sum, g) => sum + g.serviceCount, 0);

  return (
    <>
      <GroupsHero locale={locale} t={t} total={total} totalServices={totalServices} />

      <section className="relative pb-24 md:pb-28 -mt-6">
        <div className="max-w-[1260px] mx-auto px-5 sm:px-6 md:px-8">
          <GroupsGrid groups={groups} locale={locale} t={t} />
        </div>
      </section>

      <NotSureCTA t={t} />
    </>
  );
}

interface HeroProps {
  locale: 'ar' | 'en';
  t: (key: MessageKey) => string;
  total: number;
  totalServices: number;
}

function GroupsHero({ t, total, totalServices }: HeroProps) {
  return (
    <section
      className="relative -mt-[88px] pt-[120px] md:pt-[140px] pb-16 md:pb-20 overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse 800px 480px at 88% 12%, color-mix(in srgb, var(--primary) 9%, transparent) 0%, transparent 60%),' +
          'radial-gradient(ellipse 720px 420px at 8% 90%, color-mix(in srgb, var(--sw-secondary-700) 5%, transparent) 0%, transparent 60%),' +
          'linear-gradient(180deg, #F1FBF9 0%, #F7FDFB 100%)',
      }}
    >
      <div className="max-w-[1260px] mx-auto px-5 sm:px-6 md:px-8">
        <div className="grid md:grid-cols-12 gap-8 md:gap-12 items-end">
          <div className="md:col-span-7">
            <span
              className="inline-flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] mb-5"
              style={{ color: 'var(--sw-primary-700)' }}
            >
              <span aria-hidden className="inline-block w-6 h-px" style={{ background: 'currentColor', opacity: 0.5 }} />
              {t('supportGroups.eyebrow')}
            </span>
            <h1
              className="font-extrabold tracking-tight"
              style={{
                fontSize: 'clamp(2.25rem, 5.5vw, 4rem)',
                lineHeight: 1.05,
                color: 'var(--sw-secondary-700)',
                letterSpacing: '-0.02em',
                maxWidth: '14ch',
              }}
            >
              {t('supportGroups.headline')}
            </h1>
          </div>

          <div className="md:col-span-5 lg:col-span-4 lg:col-start-9">
            <p className="text-[1rem] md:text-[1.0625rem] leading-[1.85]" style={{ color: 'var(--sw-body)', maxWidth: '38ch' }}>
              {t('supportGroups.lead')}
            </p>
          </div>
        </div>

        <div
          className="mt-14 md:mt-20 pt-10 grid grid-cols-1 sm:grid-cols-3 gap-y-8 sm:gap-x-12"
          style={{ borderTop: '1px solid color-mix(in srgb, var(--sw-secondary-700) 8%, transparent)' }}
        >
          <Stat value={String(total).padStart(2, '0')} label={t('supportGroups.statTotal')} />
          <Stat value={String(totalServices).padStart(2, '0')} label={t('supportGroups.statServices')} withDivider />
          <Stat icon={<BadgeCheck className="w-7 h-7" strokeWidth={1.6} aria-hidden />} label={t('clinics.statLicensed')} withDivider />
        </div>
      </div>
    </section>
  );
}

interface StatProps {
  value?: string;
  label: string;
  icon?: React.ReactNode;
  withDivider?: boolean;
}

function Stat({ value, label, icon, withDivider }: StatProps) {
  return (
    <div className="relative flex flex-col gap-3 sm:ps-12">
      {withDivider ? (
        <span
          aria-hidden
          className="hidden sm:block absolute inset-y-1 start-0 w-px"
          style={{ background: 'color-mix(in srgb, var(--sw-secondary-700) 8%, transparent)' }}
        />
      ) : null}
      <div className="flex items-center leading-none" style={{ minHeight: 'clamp(2.25rem, 5vw, 3.25rem)' }}>
        {value ? (
          <span
            className="font-extrabold tabular-nums leading-none tracking-tight"
            style={{ fontSize: 'clamp(2.25rem, 5vw, 3.25rem)', color: 'var(--sw-secondary-700)', letterSpacing: '-0.03em' }}
          >
            {value}
          </span>
        ) : (
          <span
            aria-hidden
            className="inline-flex items-center justify-center rounded-full"
            style={{
              width: 'clamp(2.75rem, 4.5vw, 3.25rem)',
              height: 'clamp(2.75rem, 4.5vw, 3.25rem)',
              background: 'color-mix(in srgb, var(--sw-primary-600) 10%, transparent)',
              color: 'var(--sw-primary-700)',
            }}
          >
            {icon}
          </span>
        )}
      </div>
      <span className="text-[0.875rem] leading-snug" style={{ color: 'var(--sw-neutral-600)', maxWidth: '24ch' }}>
        {label}
      </span>
    </div>
  );
}

interface GridProps {
  groups: GroupEntry[];
  locale: 'ar' | 'en';
  t: (key: MessageKey) => string;
}

function GroupsGrid({ groups, locale, t }: GridProps) {
  if (groups.length === 0) {
    return (
      <div className="flex justify-center mt-8">
        <div
          className="text-center py-14 px-10 bg-white rounded-2xl max-w-md w-full"
          style={{ border: '1px solid var(--sw-neutral-100)', boxShadow: 'var(--sw-shadow-xs)' }}
        >
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: 'var(--sw-primary-50)' }}>
            <Users className="w-6 h-6" style={{ color: 'var(--sw-primary-600)' }} />
          </div>
          <h3 className="text-base font-extrabold mb-2" style={{ color: 'var(--sw-secondary-700)' }}>
            {t('supportGroups.emptyTitle')}
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--sw-neutral-500)' }}>
            {t('supportGroups.empty')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
      {groups.map((c, i) => {
        const Icon = resolveIcon(null);
        const href = `/support-groups/${encodeURIComponent(c.id)}`;
        const name = locale === 'en' && c.nameEn ? c.nameEn : c.nameAr;
        return (
          <Link
            key={c.id}
            href={href}
            aria-label={`${t('supportGroups.viewCta')} — ${name}`}
            className="group relative block bg-white rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sw-primary-500)] focus-visible:ring-offset-2"
            style={{ border: '1px solid var(--sw-neutral-100)', boxShadow: 'var(--sw-shadow-xs)' }}
          >
            <span
              aria-hidden
              className="absolute top-5 end-5 text-[0.625rem] font-extrabold px-2 py-0.5 rounded-full"
              style={{ background: 'var(--sw-primary-50)', color: 'var(--sw-primary-700)' }}
            >
              {String(i + 1).padStart(2, '0')}
            </span>

            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
              style={{
                background: 'linear-gradient(135deg, var(--sw-primary-50) 0%, color-mix(in srgb, var(--primary) 18%, transparent) 100%)',
                boxShadow: '0 0 0 1px color-mix(in srgb, var(--primary) 14%, transparent)',
              }}
            >
              <Icon className="w-7 h-7" style={{ color: 'var(--sw-primary-700)' }} strokeWidth={1.6} />
            </div>

            <span
              className="inline-flex items-center gap-1 text-[0.65rem] font-bold px-2 py-0.5 rounded-full mb-3"
              style={{ background: 'var(--sw-primary-50)', color: 'var(--sw-primary-700)' }}
            >
              <Users className="w-2.5 h-2.5" />
              {t('supportGroups.badge')}
            </span>

            <h3 className="text-lg font-bold mb-2 leading-tight" style={{ color: 'var(--sw-secondary-700)' }}>
              {name}
            </h3>
            <p className="text-[0.875rem] leading-relaxed mb-5" style={{ color: 'var(--sw-neutral-600)' }}>
              {t('supportGroups.defaultDescription')}
            </p>

            <div
              className="flex items-center gap-4 pt-4 mb-4"
              style={{ borderTop: '1px dashed color-mix(in srgb, var(--sw-secondary-700) 10%, transparent)' }}
            >
              <Meter value={c.serviceCount} label={t('supportGroups.meterServices')} />
              <span aria-hidden className="w-px self-stretch" style={{ background: 'color-mix(in srgb, var(--sw-secondary-700) 8%, transparent)' }} />
              <Meter value={c.therapistCount} label={t('supportGroups.meterTherapists')} />
            </div>

            <span className="inline-flex items-center gap-1.5 text-[0.75rem] font-bold uppercase tracking-wider" style={{ color: 'var(--sw-primary-700)' }}>
              {t('supportGroups.viewCta')}
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center transition-transform group-hover:-translate-x-0.5"
                style={{ background: 'color-mix(in srgb, var(--primary) 12%, transparent)' }}
              >
                <ArrowLeft className="w-3 h-3" style={{ color: 'var(--sw-primary-700)' }} />
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function Meter({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[1.25rem] font-extrabold tabular-nums leading-none" style={{ color: 'var(--sw-secondary-700)' }}>
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-[0.7rem]" style={{ color: 'var(--sw-neutral-500)' }}>
        {label}
      </span>
    </div>
  );
}

function NotSureCTA({ t }: { t: (key: MessageKey) => string }) {
  return (
    <section className="pb-24 md:pb-28">
      <div className="max-w-[1260px] mx-auto px-5 sm:px-6 md:px-8">
        <div className="relative rounded-[28px] overflow-hidden p-10 md:p-14" style={{ background: 'linear-gradient(135deg, var(--sw-secondary-700) 0%, var(--sw-secondary-800) 100%)' }}>
          <div aria-hidden className="absolute -top-20 -end-16 w-72 h-72 rounded-full" style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--primary) 28%, transparent) 0%, transparent 70%)' }} />
          <div aria-hidden className="absolute -bottom-24 -start-12 w-80 h-80 rounded-full" style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--accent) 18%, transparent) 0%, transparent 70%)' }} />
          <div className="relative z-10 grid md:grid-cols-12 gap-6 md:gap-10 items-center">
            <div className="md:col-span-8">
              <h2 className="font-extrabold tracking-tight text-white mb-3" style={{ fontSize: 'clamp(1.5rem, 3vw, 2.125rem)', lineHeight: 1.2, letterSpacing: '-0.015em' }}>
                {t('clinics.notSure.title')}
              </h2>
              <p className="leading-[1.85] text-[0.9375rem] md:text-[1rem]" style={{ color: 'rgba(255,255,255,0.78)', maxWidth: '52ch' }}>
                {t('clinics.notSure.body')}
              </p>
            </div>
            <div className="md:col-span-4 md:flex md:justify-end">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-[0.9375rem] font-semibold transition-all hover:-translate-y-[2px]"
                style={{ color: 'var(--sw-secondary-700)', boxShadow: 'var(--sw-shadow-md)' }}
              >
                {t('clinics.notSure.cta')}
                <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
