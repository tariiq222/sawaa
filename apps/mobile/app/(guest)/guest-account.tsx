import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { CircleUserRound } from 'lucide-react-native';

import { GuestSignInPrompt } from '@/components/features/guest/GuestSignInPrompt';
import { sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa/tokens';
import { Glass } from '@/theme/components/Glass';
import { AppIcon } from '@/components/ui/AppIcon';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { AquaBackground } from '@/theme/sawaa';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

export default function GuestAccountScreen() {
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
          {t('tabs.profile')}
        </Text>
        <Glass variant="strong" style={styles.card}>
          <View style={[styles.heading, { flexDirection: dir.row }]}>
            <AppIcon sf="person.crop.circle" fallback={CircleUserRound} size={27} color={colors.teal[700]} />
            <Text style={[styles.cardTitle, { color: colors.ink[900], fontFamily: bold, textAlign: dir.textAlign }]}>
              {t('guest.visitorAccount')}
            </Text>
          </View>
          <Text style={[styles.body, { color: colors.ink[700], fontFamily: regular, textAlign: dir.textAlign }]}>
            {t('guest.accountIntro')}
          </Text>
        </Glass>
        <GuestSignInPrompt title={t('tabs.myAppointments')} description={t('guest.accountAppointmentsHint')}
          actionLabel={t('guest.signInForAppointments')} variant="secondary" onPress={() => router.push('/(auth)/login')} />
      </ScrollView>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: sawaaSpacing.lg, gap: sawaaSpacing.lg },
  title: { fontSize: sawaaType.heading.fontSize, lineHeight: sawaaType.heading.lineHeight, marginBottom: 8 },
  card: { borderRadius: sawaaRadius.lg, padding: sawaaSpacing.lg, gap: sawaaSpacing.md },
  heading: { alignItems: 'center', gap: 10 },
  cardTitle: { flex: 1, minWidth: 0, flexShrink: 1, fontSize: sawaaType.subheading.fontSize, lineHeight: sawaaType.subheading.lineHeight },
  body: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight },
});
