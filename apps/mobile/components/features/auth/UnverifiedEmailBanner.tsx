import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Mail, Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/theme/components/ThemedText';
import { useAppSelector } from '@/hooks/use-redux';
import { useRequestEmailVerification } from '@/hooks/queries';

export function UnverifiedEmailBanner() {
  const { t } = useTranslation();
  const user = useAppSelector((s) => s.auth.user);
  const [sent, setSent] = useState(false);

  const requestVerification = useRequestEmailVerification();

  if (!user || user.emailVerifiedAt) return null;

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
      <View style={[styles.banner, styles.bannerSuccess]}>
        <Check size={18} strokeWidth={1.5} color="#16A34A" />
        <View style={styles.textWrap}>
          <ThemedText variant="bodySm" style={{ fontWeight: '500' }}>
            {t('settings.verificationSent')}
          </ThemedText>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.banner, styles.bannerWarning]}>
      <Mail size={18} strokeWidth={1.5} color="#F59E0B" />
      <View style={styles.textWrap}>
        <ThemedText variant="bodySm" style={{ fontWeight: '500' }}>
          {t('settings.unverifiedEmail')}
        </ThemedText>
        <Pressable onPress={handleSend} disabled={requestVerification.isPending}>
          <ThemedText
            variant="caption"
            color="#1D4ED8"
            style={{ fontWeight: '600' }}
          >
            {requestVerification.isPending ? t('common.loading') : t('settings.sendVerification')}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
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
  bannerWarning: {
    backgroundColor: '#F59E0B14',
  },
  bannerSuccess: {
    backgroundColor: '#16A34A14',
  },
  textWrap: { flex: 1, gap: 2 },
});
