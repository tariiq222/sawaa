import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BellRing, CalendarDays, CalendarPlus, CalendarX2, type LucideIcon } from 'lucide-react-native';

import { AccountScaffold } from '@/components/features/account/AccountScaffold';
import { AppButton } from '@/components/ui/AppButton';
import { Glass } from '@/theme/components/Glass';
import { ThemedText } from '@/theme/components/ThemedText';
import { useDir } from '@/hooks/useDir';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { sawaaRadius, sawaaSpacing } from '@/theme/sawaa/tokens';

const BENEFITS: { key: string; icon: LucideIcon }[] = [
  { key: 'guest.benefitBook', icon: CalendarPlus },
  { key: 'guest.appointmentsBenefitTrack', icon: BellRing },
  { key: 'guest.appointmentsBenefitCancel', icon: CalendarX2 },
];

/** Guest appointments tab: one card explaining what signing in unlocks, with sign-in first and booking second. */
export default function GuestAppointmentsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const dir = useDir();
  const colors = useSawaaColors();
  return (
    <AccountScaffold title={t('tabs.myAppointments')}>
      <Glass variant="strong" radius={sawaaRadius.lg} style={styles.card}>
        <View style={[styles.hero, { backgroundColor: colors.teal[50] }]}>
          <CalendarDays size={36} color={colors.teal[700]} strokeWidth={1.6} />
        </View>
        <ThemedText variant="subheading" style={styles.center}>{t('guest.appointmentsTitle')}</ThemedText>
        <ThemedText variant="body" color={colors.ink[700]} style={styles.center}>{t('guest.appointmentsIntro')}</ThemedText>
        <View style={styles.benefits}>
          {BENEFITS.map(({ key, icon: Icon }) => (
            <View key={key} style={[styles.benefit, { flexDirection: dir.row }]}>
              <Icon size={20} color={colors.teal[700]} />
              <ThemedText variant="body" style={styles.benefitText}>{t(key)}</ThemedText>
            </View>
          ))}
        </View>
        <AppButton label={t('guest.signInForAppointments')}
          onPress={() => router.push({ pathname: '/(auth)/login', params: { redirect: '/(client)/(tabs)/appointments' } })} />
        <AppButton label={t('home.bookNow')} variant="ghost" size="sm"
          onPress={() => router.push({ pathname: '/public-list/[kind]', params: { kind: 'clinics' } })} />
      </Glass>
    </AccountScaffold>
  );
}

const styles = StyleSheet.create({
  card: { padding: sawaaSpacing.lg, gap: sawaaSpacing.md, alignItems: 'stretch' },
  hero: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  center: { textAlign: 'center' },
  benefits: { gap: sawaaSpacing.sm, marginVertical: sawaaSpacing.xs },
  benefit: { alignItems: 'center', gap: sawaaSpacing.sm },
  benefitText: { flex: 1, minWidth: 0 },
});
