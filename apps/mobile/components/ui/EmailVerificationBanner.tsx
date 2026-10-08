import React, { useRef, useState } from 'react';
import { View, Pressable, Alert, StyleSheet } from 'react-native';
import { Mail, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';

import { AppButton } from './AppButton';
import { useDir } from '@/hooks/useDir';
import { ThemedText } from '@/theme/components/ThemedText';
import { useTheme } from '@/theme/useTheme';
import { withAlpha } from '@/theme/sawaa/tokens';
import { useAppSelector } from '@/hooks/use-redux';
import { authService } from '@/services/auth';

interface EmailVerificationBannerProps {
  onDismiss?: () => void;
}

/**
 * Soft banner — shown after registration if email not verified.
 * Does NOT block the user from browsing.
 * Critical actions (booking, payment, rating) should check
 * `user.emailVerified` before proceeding.
 */
export function EmailVerificationBanner({ onDismiss }: EmailVerificationBannerProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const dir = useDir();
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<'sent' | 'sendError' | null>(null);
  const user = useAppSelector((s) => s.auth.user);

  if (!user || user.role === 'CLIENT' || user.emailVerified) return null;

  const handleResend = async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setOutcome(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await authService.sendVerificationEmail();
      setOutcome('sent');
    } catch {
      setOutcome('sendError');
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  return (
    <View style={[styles.banner, { backgroundColor: withAlpha(theme.colors.warning, 0.08), flexDirection: dir.row }]}>
      <Mail size={18} strokeWidth={1.5} color={theme.colors.warning} />
      <View style={styles.textWrap}>
        <ThemedText variant="bodySm" style={{ fontWeight: '500' }}>
          {t('verification.bannerTitle')}
        </ThemedText>
        <AppButton label={t('verification.resend')} onPress={handleResend} loading={pending} variant="ghost" size="sm" />
        {outcome ? <ThemedText variant="caption" accessibilityLiveRegion="polite"
          accessibilityRole={outcome === 'sendError' ? 'alert' : undefined}
          color={outcome === 'sendError' ? theme.colors.error : theme.colors.textSecondary}>{t(`verification.${outcome}`)}</ThemedText> : null}
      </View>
      {onDismiss && (
        <Pressable onPress={onDismiss} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel={t('verification.dismiss')}>
          <X size={16} strokeWidth={1.5} color={theme.colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

/**
 * Gate function — call before critical actions.
 * Returns true if verified, false + shows alert if not.
 */
export function requireEmailVerification(
  user: { emailVerified: boolean; role?: string } | null,
  t: (key: string) => string,
): boolean {
  if (!user) return false;
  if (user.role === 'CLIENT') return true;
  if (user.emailVerified) return true;

  Alert.alert(t('verification.requiredTitle'), t('verification.requiredMessage'));
  return false;
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  textWrap: { flex: 1, minWidth: 0, gap: 2 },
  closeBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
