import React, { useCallback } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/theme/components/ThemedText';
import { Glass } from '@/theme/components/Glass';
import { useTheme } from '@/theme/useTheme';
import { sawaaRadius } from '@/theme/sawaa';
import { SettingsScaffold } from '@/components/features/settings/SettingsScaffold';
import { GlassSwitch } from '@/components/ui/GlassSwitch';
import { usePushPreference } from '@/hooks/queries/usePushPreference';

/** Purpose-built route: notification delivery preferences only. */
export default function NotificationSettingsScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { query: pushPreference, mutation: pushMutation } = usePushPreference();
  const pushEnabled = pushPreference.data?.enabled === true && pushPreference.data?.permitted === true;

  const handleTogglePush = useCallback(
    async (val: boolean) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      try {
        await pushMutation.mutateAsync(val);
      } catch {
        Alert.alert(t('settings.pushNotifications'), t('settings.pushUpdateError'));
      }
    },
    [pushMutation, t],
  );

  return (
    <SettingsScaffold title={t('settings.pushNotifications')}>
      <Glass variant="strong" radius={sawaaRadius.xl} style={styles.card}>
        <ThemedText
          variant="bodySm"
          color={theme.colors.textSecondary}
          style={styles.description}
        >
          {t('settings.pushNotificationsDesc')}
        </ThemedText>
        <View style={styles.switchRow}>
          <ThemedText variant="body">{t('settings.enablePush')}</ThemedText>
          <GlassSwitch
            value={pushEnabled}
            disabled={pushPreference.isPending || pushPreference.isError || pushMutation.isPending}
            onValueChange={handleTogglePush}
            accessibilityLabel={t('settings.pushNotifications')}
          />
        </View>
      </Glass>
    </SettingsScaffold>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20 },
  description: { marginBottom: 12 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
