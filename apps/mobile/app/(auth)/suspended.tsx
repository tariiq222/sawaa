import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Lock } from 'lucide-react-native';
import { AuthFormScaffold } from '@/components/features/auth/AuthFormScaffold';
import { AppButton } from '@/components/ui/AppButton';
import { PrimaryButton } from '@/theme/sawaa/PrimaryButton';
import { sawaaType, withAlpha } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { authService } from '@/services/auth';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';

export default function SuspendedScreen() {
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
    <AuthFormScaffold>
      <View style={styles.container}>
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
          <PrimaryButton label={t('auth.logout')} onPress={handleLogout} fontFamily={f700} />
          <AppButton variant="secondary" label={t('suspended.continueAsGuest')}
            onPress={() => router.replace('/(guest)/home')} />
        </View>
      </View>
    </AuthFormScaffold>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center' },
  lockCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginTop: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(colors.accent.amber, 0.2),
  },
  title: { fontSize: sawaaType.heading.fontSize, lineHeight: sawaaType.heading.lineHeight, color: colors.ink[900], textAlign: 'center', marginTop: 24 },
  body: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight, color: colors.ink[700], textAlign: 'center', marginTop: 8, marginBottom: 32 },
  actions: { alignSelf: 'stretch', gap: 12 },
});
