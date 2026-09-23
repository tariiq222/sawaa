import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { authService } from '@/services/auth';
import { sawaaColors } from '@/theme/sawaa';
import { ThemedText } from '@/theme/components/ThemedText';

export function DeleteAccountButton() {
  const { t } = useTranslation();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);

  const closeAccount = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      await authService.requestAccountDeletion();
    } catch {
      Alert.alert(t('profile.deleteAccountTitle'), t('profile.deleteAccountError'));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: busy }}
      disabled={busy}
      onPress={() => {
        Alert.alert(t('profile.deleteAccountTitle'), t('profile.deleteAccountBody'), [
          { text: t('profile.deleteAccountCancel'), style: 'cancel' },
          { text: t('profile.deleteAccountConfirm'), style: 'destructive', onPress: () => void closeAccount() },
        ]);
      }}
      style={styles.button}
    >
      <ThemedText variant="body" style={styles.text}>
        {t('profile.deleteAccount')}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', paddingVertical: 14 },
  text: { color: sawaaColors.accent.coral },
});
