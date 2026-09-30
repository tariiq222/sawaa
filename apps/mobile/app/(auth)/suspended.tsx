import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Lock } from 'lucide-react-native';
import { AquaBackground } from '@/theme/sawaa';
import { PrimaryButton } from '@/theme/sawaa/PrimaryButton';
import { sawaaRadius, withAlpha } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { authService } from '@/services/auth';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';

export default function SuspendedScreen() {
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const dir = useDir();
  const f400 = getFontName(dir.locale, '400');
  const f700 = getFontName(dir.locale, '700');

  async function handleLogout() {
    await authService.logout();
    router.replace('/(auth)/login');
  }

  return (
    <AquaBackground>
      <View style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.lockCircle}>
          <Lock size={44} color={colors.accent.amber} strokeWidth={1.75} />
        </View>
        <Text accessibilityRole="header" style={[styles.title, { fontFamily: f700, writingDirection: dir.writingDirection }]}>
          {t('suspended.title')}
        </Text>
        <Text style={[styles.body, { fontFamily: f400, writingDirection: dir.writingDirection }]}>
          {t('suspended.message')}
        </Text>
        <View style={styles.actions}>
          <PrimaryButton label={t('suspended.contactAdmin')} onPress={handleLogout} fontFamily={f700} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('suspended.continueAsGuest')}
            style={styles.secondary}
            onPress={() => router.replace('/home')}
          >
            <Text style={[styles.secondaryText, { fontFamily: f700 }]}>{t('suspended.continueAsGuest')}</Text>
          </Pressable>
        </View>
      </View>
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  container: { flex: 1, alignItems: 'center', paddingHorizontal: 16 },
  lockCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginTop: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(colors.accent.amber, 0.2),
  },
  title: { fontSize: 24, lineHeight: 32, color: colors.ink[900], textAlign: 'center', marginTop: 24 },
  body: { fontSize: 15, lineHeight: 24, color: colors.ink[700], textAlign: 'center', marginTop: 8, marginBottom: 32 },
  actions: { alignSelf: 'stretch', gap: 12 },
  secondary: {
    minHeight: 56,
    borderRadius: sawaaRadius.pill,
    borderWidth: 1,
    borderColor: colors.teal[700],
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontSize: 16, color: colors.teal[700] },
});
