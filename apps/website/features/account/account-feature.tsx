'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/features/locale/locale';
import { useT } from '@/features/locale/locale-provider';
import { useCurrentClient, clearAuth, clientLogoutApi } from '@/features/auth/public';
import { ClientBookingsList } from '@/features/auth/client-bookings-list';
import { OverviewTab } from './overview-tab';
import { InvoicesTab } from './invoices-tab';
import { ProfileTab } from './profile-tab';
import { Mail, Phone, BadgeCheck, LogOut, User, ArrowRight, X } from 'lucide-react';

interface AccountFeatureProps {
  locale: Locale;
}

type AccountTab = 'overview' | 'bookings' | 'invoices' | 'profile';

const TABS: AccountTab[] = ['overview', 'bookings', 'invoices', 'profile'];

const emptySubscribe = () => () => {};

export function AccountFeature({ locale }: AccountFeatureProps) {
  const { client, isLoading, error } = useCurrentClient();
  const router = useRouter();
  const tt = useT();
  const [loggingOut, setLoggingOut] = useState(false);
  const [activeTab, setActiveTab] = useState<AccountTab>('overview');
  // Dismissible per render only — reappears on the next visit to /account.
  const [emailNoticeDismissed, setEmailNoticeDismissed] = useState(false);
  // Hydration gate: the client profile is restored synchronously from the
  // persisted auth store, so the first client render could differ from the
  // server-rendered loading state. Render the same loading placeholder until
  // after hydration so server and first client render always match.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!isLoading && (error || client === null)) {
      router.push('/login');
    }
  }, [client, error, router, isLoading]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await clientLogoutApi();
    } catch {
      // ignore — clear local + redirect anyway
    }
    clearAuth();
    router.push('/login');
  }

  if (!mounted || isLoading || error || client === null) {
    return (
      <div className="grid place-items-center py-24 text-[var(--sw-neutral-500)]">
        {tt('common.loading')}
      </div>
    );
  }

  const firstName = client.name?.split(' ')[0] ?? client.name ?? '';

  return (
    <div className="flex flex-col gap-8">
      <ProfileCard
        name={client.name}
        email={client.email}
        phone={client.phone}
        emailVerified={client.emailVerified != null}
        greeting={`${tt('account.greeting')} ${firstName}`}
        subtitle={tt('account.subtitle')}
        emailVerifiedLabel={tt('account.emailVerified')}
        notVerifiedLabel={tt('account.notVerified')}
        emailLabel={tt('account.email')}
        phoneLabel={tt('account.phone')}
        logoutLabel={tt('account.logout')}
        loggingOutLabel={tt('account.loggingOut')}
        loggingOut={loggingOut}
        onLogout={handleLogout}
      />

      <div
        className="flex gap-1 p-1 rounded-full self-start max-w-full overflow-x-auto"
        style={{ background: 'var(--sw-neutral-100)' }}
        role="tablist"
      >
        {TABS.map((tab) => {
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              role="tab"
              aria-selected={active}
              aria-controls={`account-panel-${tab}`}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap ${
                active
                  ? 'bg-[var(--sw-neutral-0)] text-[var(--sw-secondary-700)] shadow-[var(--sw-shadow-sm)]'
                  : 'text-[var(--sw-neutral-500)] hover:text-[var(--sw-secondary-700)]'
              }`}
            >
              {tt(`account.tabs.${tab}`)}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`account-panel-${activeTab}`}>
        {activeTab === 'overview' && client.email === null && !emailNoticeDismissed && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 px-4 py-3 mb-6 rounded-2xl text-sm"
            style={{
              background: 'color-mix(in srgb, var(--sw-primary-500) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--sw-primary-500) 25%, transparent)',
              color: 'var(--sw-primary-600)',
            }}
          >
            <span className="inline-flex items-center gap-2 font-semibold">
              <Mail size={16} aria-hidden="true" />
              {tt('account.addEmail.notice')}
            </span>
            <span className="inline-flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className="inline-flex items-center gap-1 font-bold hover:underline"
              >
                {tt('account.addEmail.cta')}
                <ArrowRight size={13} className="rtl:rotate-180" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setEmailNoticeDismissed(true)}
                aria-label={tt('account.addEmail.dismiss')}
                className="inline-flex items-center hover:opacity-70"
              >
                <X size={15} aria-hidden="true" />
              </button>
            </span>
          </div>
        )}
        {activeTab === 'overview' && (
          <OverviewTab locale={locale} onGoToInvoices={() => setActiveTab('invoices')} />
        )}
        {activeTab === 'bookings' && <ClientBookingsList locale={locale} />}
        {activeTab === 'invoices' && <InvoicesTab locale={locale} />}
        {activeTab === 'profile' && <ProfileTab />}
      </div>
    </div>
  );
}

interface ProfileCardProps {
  name: string;
  email: string | null;
  phone: string | null;
  emailVerified: boolean;
  greeting: string;
  subtitle: string;
  emailVerifiedLabel: string;
  notVerifiedLabel: string;
  emailLabel: string;
  phoneLabel: string;
  logoutLabel: string;
  loggingOutLabel: string;
  loggingOut: boolean;
  onLogout: () => void;
}

function ProfileCard(props: ProfileCardProps) {
  return (
    <div
      className="relative overflow-hidden rounded-[24px] p-6 sm:p-8"
      style={{
        background:
          'linear-gradient(135deg, color-mix(in srgb, var(--sw-primary-500) 8%, var(--sw-neutral-0)) 0%, var(--sw-neutral-0) 70%)',
        border: '1px solid color-mix(in srgb, var(--sw-primary-500) 12%, transparent)',
        boxShadow: 'var(--sw-shadow-md)',
      }}
    >
      <div
        className="absolute -top-12 -end-12 w-44 h-44 rounded-full pointer-events-none"
        style={{ background: 'color-mix(in srgb, var(--sw-primary-500) 10%, transparent)' }}
        aria-hidden="true"
      />

      <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div
            className="shrink-0 w-12 h-12 rounded-full grid place-items-center text-[var(--sw-neutral-0)]"
            style={{
              background: 'var(--sw-primary-500)',
              boxShadow: 'var(--sw-shadow-primary)',
            }}
            aria-hidden="true"
          >
            <User size={22} />
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-sm text-[var(--sw-body)]">{props.greeting}</p>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[var(--sw-secondary-700)] leading-tight">
              {props.name}
            </h1>
            <p className="text-sm text-[var(--sw-body)] mt-1 max-w-md leading-relaxed">
              {props.subtitle}
            </p>
          </div>
        </div>

        <button
          onClick={props.onLogout}
          disabled={props.loggingOut}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border bg-[var(--sw-neutral-0)] text-[var(--error)] border-[color-mix(in_srgb,var(--error)_25%,transparent)] hover:bg-[color-mix(in_srgb,var(--error)_6%,transparent)] transition-colors disabled:opacity-60"
        >
          <LogOut size={14} aria-hidden="true" className="rtl:scale-x-[-1]" />
          {props.loggingOut ? props.loggingOutLabel : props.logoutLabel}
        </button>
      </div>

      <div className="relative mt-6 grid sm:grid-cols-2 gap-3">
        <InfoTile
          icon={<Mail size={14} aria-hidden="true" />}
          label={props.emailLabel}
          value={props.email ?? '—'}
          badge={
            props.email
              ? {
                  ok: props.emailVerified,
                  okLabel: props.emailVerifiedLabel,
                  warnLabel: props.notVerifiedLabel,
                }
              : null
          }
        />
        <InfoTile
          icon={<Phone size={14} aria-hidden="true" />}
          label={props.phoneLabel}
          value={props.phone ?? '—'}
        />
      </div>
    </div>
  );
}

function InfoTile({
  icon,
  label,
  value,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  badge?: { ok: boolean; okLabel: string; warnLabel: string } | null;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[var(--sw-neutral-0)] border border-[var(--sw-neutral-100)]">
      <span className="shrink-0 w-8 h-8 rounded-full grid place-items-center bg-[color-mix(in_srgb,var(--sw-primary-500)_10%,transparent)] text-[var(--sw-primary-600)]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[var(--sw-neutral-500)]">{label}</p>
        <p className="text-sm font-semibold text-[var(--sw-secondary-700)] truncate">{value}</p>
      </div>
      {badge && (
        <span
          className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold ${
            badge.ok
              ? 'bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-[var(--success)]'
              : 'bg-[color-mix(in_srgb,var(--warning)_14%,transparent)] text-[var(--warning)]'
          }`}
        >
          {badge.ok && <BadgeCheck size={11} aria-hidden="true" />}
          {badge.ok ? badge.okLabel : badge.warnLabel}
        </span>
      )}
    </div>
  );
}
