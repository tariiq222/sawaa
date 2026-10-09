import React, { useState } from 'react';
import { Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Phone, Ticket } from 'lucide-react-native';

import { AccountScaffold } from '@/components/features/account/AccountScaffold';
import { AccountHeaderCard, type AccountStat } from '@/components/features/account/AccountHeaderCard';
import { AccountPreferences } from '@/components/features/account/AccountPreferences';
import { SignOutRow } from '@/components/features/account/SignOutRow';
import { AboutSection } from '@/components/features/settings/AboutSection';
import { MenuGroup, type MenuEntry } from '@/components/ui/MenuGroup';
import { useDir } from '@/hooks/useDir';
import { useAppSelector } from '@/hooks/use-redux';
import { useBranding, useSummary } from '@/hooks/queries';
import { formatCurrencyAmount } from '@/lib/currency-display';

function formatLastVisit(iso: string | null, isRTL: boolean): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(isRTL ? 'ar-SA' : 'en-US', { calendar: 'gregory', day: 'numeric', month: 'short' }).format(new Date(iso));
}

/**
 * Client account tab. Everything the client owns sits on this one screen:
 * identity (opens personal details), packages balance, preferences, support,
 * about, and sign-out. Only personal details and packages open a new page.
 */
export default function AccountTabScreen() {
  const { t } = useTranslation();
  const dir = useDir();
  const router = useRouter();
  const user = useAppSelector((s) => s.auth.user);
  const summaryQuery = useSummary();
  const summary = summaryQuery.data ?? null;
  const contactPhone = useBranding().data?.contactPhone ?? null;
  const [refreshing, setRefreshing] = useState(false);

  const displayName = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email : '—';

  const onRefresh = async () => {
    setRefreshing(true);
    try { await summaryQuery.refetch(); } finally { setRefreshing(false); }
  };

  const stats: AccountStat[] = [
    { key: 'sessions', value: summary ? (dir.isRTL ? summary.totalBookings.toLocaleString('ar-SA') : String(summary.totalBookings)) : '—', label: t('profile.sessions'), direction: 'ltr' },
    { key: 'lastVisit', value: summary ? formatLastVisit(summary.lastVisit, dir.isRTL) : '—', label: t('profile.lastVisit') },
    // outstandingBalance is integer halalas.
    { key: 'outstanding', value: summary ? formatCurrencyAmount(summary.outstandingBalance, 'SAR', dir.isRTL) : '—', label: t('profile.outstanding'), direction: 'ltr' },
  ];

  const support: MenuEntry[] = contactPhone ? [{
    key: 'crisis',
    icon: Phone,
    label: t('profile.crisisSupport.title'),
    description: t('profile.crisisSupport.subtitle'),
    value: contactPhone,
    valueDirection: 'ltr',
    onPress: () => { void Linking.openURL(`tel:${contactPhone}`); },
  }] : [];

  return (
    <AccountScaffold title={t('profile.title')} refreshing={refreshing} onRefresh={() => { void onRefresh(); }}>
      <AccountHeaderCard
        name={displayName}
        secondary={user?.phone || user?.email}
        avatarUrl={user?.avatarUrl}
        onEdit={() => router.push('/(client)/settings-profile')}
        stats={stats}
        statsLoading={!summary && summaryQuery.isPending}
        statsError={summaryQuery.isError}
        onRetryStats={() => { void summaryQuery.refetch(); }}
      />
      <MenuGroup entries={[{
        key: 'packages',
        icon: Ticket,
        label: t('profile.myPackages'),
        description: t('profile.myPackagesHint'),
        onPress: () => router.push('/(client)/packages/purchases'),
      }]} />
      <AccountPreferences role="client" />
      {support.length ? <MenuGroup title={t('profile.support')} entries={support} /> : null}
      <AboutSection />
      <SignOutRow />
    </AccountScaffold>
  );
}
