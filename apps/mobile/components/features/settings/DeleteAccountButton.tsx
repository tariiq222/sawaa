import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react-native';

import { authService } from '@/services/auth';
import { useDir } from '@/hooks/useDir';
import { AppButton } from '@/components/ui/AppButton';
import { ThemedText } from '@/theme/components/ThemedText';
import { useTheme } from '@/theme/useTheme';
import { useReduceMotion } from '@/hooks/useA11y';
import { getSawaaRoles, sawaaRadius, sawaaSpacing, withAlpha } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

/** Delete-account link that opens a confirmation bottom sheet. */
export function DeleteAccountButton() {
  const { t } = useTranslation();
  const colors = useSawaaColors();
  const dir = useDir();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const { scheme } = useTheme();
  const roles = getSawaaRoles(scheme);
  const reduceMotion = useReduceMotion();
  const { height } = useWindowDimensions();

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

  const confirm = () => {
    setOpen(false);
    void closeAccount();
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('profile.deleteAccount')}
        accessibilityState={{ disabled: busy, busy }}
        disabled={busy}
        onPress={() => setOpen(true)}
        style={[styles.trigger, { flexDirection: dir.row }]}
      >
        <Trash2 size={20} color={colors.accent.coral} strokeWidth={1.75} />
        {busy ? <ActivityIndicator color={colors.teal[700]} /> : null}
        <ThemedText variant="body">{t('profile.deleteAccount')}</ThemedText>
      </Pressable>

      <Modal visible={open} transparent animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={() => setOpen(false)}>
        <View style={[styles.backdrop, { backgroundColor: roles.scrim }]}>
          <Pressable
            testID="delete-account-backdrop"
            accessible={false}
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(false)}
          />
          <View accessibilityViewIsModal style={[styles.sheet, { maxHeight: height - insets.top }]}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + sawaaSpacing.lg }]}>
            <View style={styles.handle} />
            <View style={styles.iconCircle}>
              <Trash2 size={30} color={colors.accent.coral} strokeWidth={1.75} />
            </View>
            <ThemedText accessibilityRole="header" variant="subheading" style={styles.title}>
              {t('profile.deleteAccountSheetTitle')}
            </ThemedText>
            <ThemedText variant="body" style={styles.body}>{t('profile.deleteAccountBody')}</ThemedText>
            <AppButton variant="danger" label={t('profile.deleteAccountAction')} onPress={confirm}
              disabled={busy} loading={busy} style={styles.action} />
            <AppButton variant="secondary" label={t('profile.deleteAccountCancel')} onPress={() => setOpen(false)} style={styles.action} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  trigger: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center', gap: sawaaSpacing.sm, minHeight: 48, paddingHorizontal: sawaaSpacing.lg },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.glass.opaqueBg,
    borderTopLeftRadius: sawaaRadius.xl,
    borderTopRightRadius: sawaaRadius.xl,
  },
  sheetContent: {
    paddingHorizontal: sawaaSpacing.lg, paddingTop: sawaaSpacing.md, alignItems: 'center', gap: sawaaSpacing.md,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.ink[400], marginBottom: 6 },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(colors.accent.coral, 0.16),
  },
  title: { textAlign: 'center' },
  body: { textAlign: 'center', marginBottom: 8 },
  action: { alignSelf: 'stretch' },
});
