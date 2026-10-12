import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Bell, CalendarCheck, CalendarPlus, type LucideIcon } from 'lucide-react-native';

import { Glass } from '@/theme/components/Glass';
import { ThemedText } from '@/theme/components/ThemedText';
import { AppButton } from '@/components/ui/AppButton';
import { useDir } from '@/hooks/useDir';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { sawaaRadius, sawaaSpacing } from '@/theme/sawaa/tokens';

const BENEFITS: { key: string; icon: LucideIcon }[] = [
  { key: 'guest.benefitBook', icon: CalendarPlus },
  { key: 'guest.benefitTrack', icon: CalendarCheck },
  { key: 'guest.benefitPackages', icon: Bell },
];

/** Top of the guest account tab: what signing in unlocks and the one sign-in action. */
export function GuestWelcomeCard({ onSignIn }: { onSignIn: () => void }) {
  const { t } = useTranslation();
  const dir = useDir();
  const colors = useSawaaColors();
  return (
    <Glass variant="strong" radius={sawaaRadius.lg} style={styles.card}>
      <View style={[styles.heading, { flexDirection: dir.row }]}>
        <Image source={require('@/assets/sawa/logo.png')} resizeMode="contain" accessible={false} style={styles.logo} />
        <ThemedText variant="subheading" style={styles.title}>{t('guest.welcomeTitle')}</ThemedText>
      </View>
      <View style={styles.benefits}>
        {BENEFITS.map(({ key, icon: Icon }) => (
          <View key={key} style={[styles.benefit, { flexDirection: dir.row }]}>
            <Icon size={20} color={colors.teal[700]} />
            <ThemedText variant="body" style={styles.benefitText}>{t(key)}</ThemedText>
          </View>
        ))}
      </View>
      <AppButton label={t('guest.signInOrRegister')} onPress={onSignIn} />
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: { padding: sawaaSpacing.lg, gap: sawaaSpacing.lg },
  heading: { alignItems: 'center', gap: sawaaSpacing.md },
  logo: { width: 48, height: 48 },
  title: { flex: 1, minWidth: 0, flexShrink: 1 },
  benefits: { gap: sawaaSpacing.sm },
  benefit: { alignItems: 'center', gap: sawaaSpacing.sm },
  benefitText: { flex: 1, minWidth: 0 },
});
