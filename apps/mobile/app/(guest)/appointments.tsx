import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { CalendarDays } from 'lucide-react-native';

import { Glass } from '@/theme/components/Glass';
import { AppIcon } from '@/components/ui/AppIcon';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { AquaBackground } from '@/theme/sawaa';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

export default function GuestAppointmentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const dir = useDir();
  const colors = useSawaaColors();
  const regular = getFontName(dir.locale, '400');
  const bold = getFontName(dir.locale, '700');

  return (
    <AquaBackground>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 130 }]}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.ink[900], fontFamily: bold, textAlign: dir.textAlign }]}>
          {t('tabs.myAppointments')}
        </Text>
        <Glass variant="strong" style={styles.card}>
          <AppIcon sf="calendar" fallback={CalendarDays} size={30} color={colors.teal[700]} />
          <Text style={[styles.body, { color: colors.ink[700], fontFamily: regular, textAlign: dir.textAlign }]}>
            {t('guest.accountAppointmentsHint')}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('guest.signInForAppointments')}
            onPress={() => router.push('/(auth)/login')}
            style={[styles.action, { borderColor: colors.teal[700] }]}>
            <Text style={[styles.actionText, { color: colors.teal[700], fontFamily: bold }]}>{t('guest.signInForAppointments')}</Text>
          </Pressable>
        </Glass>
      </ScrollView>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, gap: 18 },
  title: { fontSize: 28, lineHeight: 38, marginBottom: 8 },
  card: { borderRadius: 24, padding: 20, alignItems: 'center', gap: 16 },
  body: { alignSelf: 'stretch', fontSize: 15, lineHeight: 24 },
  action: { alignSelf: 'stretch', minHeight: 50, borderWidth: 1, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 15 },
});
