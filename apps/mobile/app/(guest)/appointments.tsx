import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { GuestSignInPrompt } from '@/components/features/guest/GuestSignInPrompt';
import { sawaaSpacing, sawaaType } from '@/theme/sawaa/tokens';
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
  const bold = getFontName(dir.locale, '700');

  return (
    <AquaBackground>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 130 }]}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.ink[900], fontFamily: bold, textAlign: dir.textAlign }]}>
          {t('tabs.myAppointments')}
        </Text>
        <GuestSignInPrompt description={t('guest.accountAppointmentsHint')} actionLabel={t('guest.signInForAppointments')}
          onPress={() => router.push('/(auth)/login')} />
      </ScrollView>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: sawaaSpacing.lg, gap: sawaaSpacing.lg },
  title: { fontSize: sawaaType.heading.fontSize, lineHeight: sawaaType.heading.lineHeight, marginBottom: 0 },
});
