import { useMemo, useState } from 'react';
import { useTheme } from '@/theme/useTheme';
import { withAlpha } from '@/theme/sawaa/tokens';
import { View, Pressable, StyleSheet } from 'react-native';
import { Mail, Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/theme/components/ThemedText';
import { useAppSelector } from '@/hooks/use-redux';
import { useRequestEmailVerification } from '@/hooks/queries';

export function UnverifiedEmailBanner() {
  const { t } = useTranslation();
  const { theme, isRTL } = useTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);
  const user = useAppSelector((s) => s.auth.user);
  const [sent, setSent] = useState(false);

  const requestVerification = useRequestEmailVerification();

  if (!user || user.role === 'CLIENT' || user.emailVerifiedAt) return null;

  const handleSend = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await requestVerification.mutateAsync();
      setSent(true);
    } catch {
      // silent
    }
  };

  if (sent) {
    return (
      <View style={[styles.banner, styles.bannerSuccess, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Check size={18} strokeWidth={1.5} color={theme.colors.success} />
        <View style={styles.textWrap}>
          <ThemedText variant="bodySm" style={{ fontWeight: '500' }}>
            {t('settings.verificationSent')}
          </ThemedText>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.banner, styles.bannerWarning, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      <Mail size={18} strokeWidth={1.5} color={theme.colors.warning} />
      <View style={styles.textWrap}>
        <ThemedText variant="bodySm" style={{ fontWeight: '500' }}>
          {t('settings.unverifiedEmail')}
        </ThemedText>
        <Pressable onPress={handleSend} disabled={requestVerification.isPending}>
          <ThemedText
            variant="caption"
            color={theme.colors.info}
            style={{ fontWeight: '600' }}
          >
            {requestVerification.isPending ? t('common.loading') : t('settings.sendVerification')}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>['theme']['colors']) => StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  bannerWarning: {
    backgroundColor: withAlpha(colors.warning, 0.08),
  },
  bannerSuccess: {
    backgroundColor: withAlpha(colors.success, 0.08),
  },
  textWrap: { flex: 1, gap: 2 },
});
