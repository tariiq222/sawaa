import React from 'react';
import { View, Pressable, Alert, StyleSheet } from 'react-native';
import { Mail, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/theme/components/ThemedText';
import { useTheme } from '@/theme/useTheme';
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
  const user = useAppSelector((s) => s.auth.user);

  if (!user || user.emailVerified) return null;

  const handleResend = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await authService.sendVerificationEmail();
    } catch {
      // Silent — don't block UX
    }
  };

  return (
    <View style={[styles.banner, { backgroundColor: '#F59E0B14' }]}>
      <Mail size={18} strokeWidth={1.5} color="#F59E0B" />
      <View style={styles.textWrap}>
        <ThemedText variant="bodySm" style={{ fontWeight: '500' }}>
          {t('verification.bannerTitle')}
        </ThemedText>
        <Pressable onPress={handleResend}>
          <ThemedText variant="caption" color="#1D4ED8" style={{ fontWeight: '600' }}>
            {t('verification.resend')}
          </ThemedText>
        </Pressable>
      </View>
      {onDismiss && (
        <Pressable onPress={onDismiss} style={styles.closeBtn}>
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
  user: { emailVerified: boolean } | null,
  t: (key: string) => string,
): boolean {
  if (!user) return false;
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
  textWrap: { flex: 1, gap: 2 },
  closeBtn: { padding: 4 },
});
