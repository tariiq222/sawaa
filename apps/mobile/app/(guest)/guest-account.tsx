import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { CalendarDays, CircleUserRound } from 'lucide-react-native';

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
        <Glass variant="strong" style={styles.card}>
          <View style={[styles.heading, { flexDirection: dir.row }]}>
            <AppIcon sf="calendar" fallback={CalendarDays} size={25} color={colors.teal[700]} />
            <Text style={[styles.cardTitle, { color: colors.ink[900], fontFamily: bold, textAlign: dir.textAlign }]}>
              {t('tabs.myAppointments')}
            </Text>
          </View>
          <Text style={[styles.body, { color: colors.ink[700], fontFamily: regular, textAlign: dir.textAlign }]}>
            {t('guest.accountAppointmentsHint')}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('guest.signInForAppointments')}
            onPress={() => router.push('/(auth)/login')}
            style={[styles.action, { borderColor: colors.teal[700] }]}>
            <Text style={[styles.actionText, { color: colors.teal[700], fontFamily: bold }]}>
              {t('guest.signInForAppointments')}
            </Text>
          </Pressable>
        </Glass>
      </ScrollView>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, gap: 18 },
  title: { fontSize: 28, lineHeight: 38, marginBottom: 8 },
  card: { borderRadius: 24, padding: 20, gap: 12 },
  heading: { alignItems: 'center', gap: 10 },
  cardTitle: { flex: 1, fontSize: 20, lineHeight: 28 },
  body: { fontSize: 15, lineHeight: 24 },
  action: { minHeight: 50, borderWidth: 1, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  actionText: { fontSize: 15 },
});
