import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { AquaBackground } from '@/theme/sawaa';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { authService } from '@/services/auth';

export default function SuspendedScreen() {
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();

  async function handleLogout() {
    await authService.logout();
    router.replace('/(auth)/login');
  }

  return (
    <AquaBackground>
      <View style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('suspended.title')}</Text>
          <Text style={styles.body}>{t('suspended.message')}</Text>
          <Pressable style={styles.button} onPress={handleLogout}>
            <Text style={styles.buttonText}>{t('suspended.contactAdmin')}</Text>
          </Pressable>
        </View>
      </View>
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  bg: { flex: 1 },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: colors.glass.bgStrong,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    width: '100%',
    maxWidth: 360,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink[900],
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    color: colors.ink[700],
    textAlign: 'center',
    lineHeight: 24,
  },
  button: {
    marginTop: 8,
    backgroundColor: colors.glass.bg,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: {
    color: colors.ink[900],
    fontSize: 16,
    fontWeight: '600',
  },
});