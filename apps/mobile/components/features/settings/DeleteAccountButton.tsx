import { useMemo, useRef, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react-native';

import { authService } from '@/services/auth';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { sawaaRadius, withAlpha } from '@/theme/sawaa/tokens';
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
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');

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
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={() => setOpen(true)}
        style={[styles.trigger, { flexDirection: dir.row }]}
      >
        <Trash2 size={20} color={colors.accent.coral} strokeWidth={1.75} />
        <Text style={[styles.triggerText, { fontFamily: f600 }]}>{t('profile.deleteAccount')}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable
            accessible={false}
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(false)}
          />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.handle} />
            <View style={styles.iconCircle}>
              <Trash2 size={30} color={colors.accent.coral} strokeWidth={1.75} />
            </View>
            <Text accessibilityRole="header" style={[styles.title, { fontFamily: f700 }]}>
              {t('profile.deleteAccountSheetTitle')}
            </Text>
            <Text style={[styles.body, { fontFamily: getFontName(dir.locale, '400'), writingDirection: dir.writingDirection }]}>
              {t('profile.deleteAccountBody')}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('profile.deleteAccountAction')}
              onPress={confirm}
              style={styles.destructive}
            >
              <Text style={[styles.destructiveText, { fontFamily: f700 }]}>{t('profile.deleteAccountAction')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('profile.deleteAccountCancel')}
              onPress={() => setOpen(false)}
              style={styles.cancel}
            >
              <Text style={[styles.cancelText, { fontFamily: f700 }]}>{t('profile.deleteAccountCancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  trigger: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, paddingHorizontal: 16 },
  triggerText: { fontSize: 15, color: colors.ink[900] },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: withAlpha(colors.ink[900], 0.45) },
  sheet: {
    backgroundColor: colors.glass.opaqueBg,
    borderTopLeftRadius: sawaaRadius.xl,
    borderTopRightRadius: sawaaRadius.xl,
    paddingHorizontal: 16,
    paddingTop: 10,
    alignItems: 'center',
    gap: 12,
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
  title: { fontSize: 20, lineHeight: 28, color: colors.ink[900], textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 24, color: colors.ink[700], textAlign: 'center', marginBottom: 8 },
  destructive: {
    alignSelf: 'stretch',
    minHeight: 56,
    borderRadius: sawaaRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent.coral,
  },
  destructiveText: { fontSize: 17, color: colors.ink[900] },
  cancel: {
    alignSelf: 'stretch',
    minHeight: 56,
    borderRadius: sawaaRadius.pill,
    borderWidth: 1,
    borderColor: colors.teal[700],
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontSize: 16, color: colors.teal[700] },
});
