import { useMemo, useState } from 'react';
import { useTheme } from '@/theme/useTheme';
import { sawaaRadius, sawaaSpacing, withAlpha } from '@/theme/sawaa/tokens';
import { View, StyleSheet } from 'react-native';
import { Mail, Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';

import { AppButton } from '@/components/ui/AppButton';
import { useDir } from '@/hooks/useDir';
import { ThemedText } from '@/theme/components/ThemedText';
import { useAppSelector } from '@/hooks/use-redux';
import { useRequestEmailVerification } from '@/hooks/queries';

export function UnverifiedEmailBanner() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const dir = useDir();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);
  const user = useAppSelector((s) => s.auth.user);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);

  const requestVerification = useRequestEmailVerification();

  if (!user || user.role === 'CLIENT' || user.emailVerifiedAt) return null;

  const handleSend = async () => {
    setFailed(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await requestVerification.mutateAsync();
      setSent(true);
    } catch {
      setFailed(true);
    }
  };

  if (sent) {
    return (
      <View accessibilityLiveRegion="polite" style={[styles.banner, styles.bannerSuccess, { flexDirection: dir.row }]}>
        <Check size={18} strokeWidth={1.5} color={theme.colors.success} />
        <View style={styles.textWrap}>
          <ThemedText variant="bodySm">
            {t('settings.verificationSent')}
          </ThemedText>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.banner, styles.bannerWarning, { flexDirection: dir.row }]}>
      <Mail size={18} strokeWidth={1.5} color={theme.colors.warning} />
      <View style={styles.textWrap}>
        <ThemedText variant="bodySm">
          {t('settings.unverifiedEmail')}
        </ThemedText>
        {failed && <ThemedText accessibilityRole="alert" color={theme.colors.error}>
          {t('settings.verificationError')}
        </ThemedText>}
        <AppButton variant="ghost" size="sm" label={t(failed ? 'common.retry' : 'settings.sendVerification')}
          loading={requestVerification.isPending} disabled={requestVerification.isPending} onPress={handleSend} />
      </View>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>['theme']['colors']) => StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sawaaSpacing.md,
    paddingHorizontal: sawaaSpacing.lg,
    paddingVertical: sawaaSpacing.md,
    borderRadius: sawaaRadius.sm,
    marginBottom: sawaaSpacing.lg,
  },
  bannerWarning: {
    backgroundColor: withAlpha(colors.warning, 0.08),
  },
  bannerSuccess: {
    backgroundColor: withAlpha(colors.success, 0.08),
  },
  textWrap: { flex: 1, minWidth: 0, gap: 2 },
});
