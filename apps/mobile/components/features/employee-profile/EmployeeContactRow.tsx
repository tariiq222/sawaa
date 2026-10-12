import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mail, Phone } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { AppButton } from '@/components/ui/AppButton';
import { Pill } from '@/components/ui/Pill';
import { useDir } from '@/hooks/useDir';
import { useReduceMotion } from '@/hooks/useA11y';
import { ThemedText } from '@/theme/components/ThemedText';
import { getSawaaRoles, sawaaRadius, sawaaSpacing } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useTheme } from '@/theme/useTheme';
import type { ContactChallenge, ContactRequest, ContactVerification } from '@/services/employee/profile';
import { EmployeeContactEditor } from './EmployeeContactEditor';

interface Props {
  channel: 'EMAIL' | 'SMS'; currentValue: string | null; request: (input: ContactRequest) => Promise<ContactChallenge>;
  verify: (input: ContactVerification) => Promise<unknown>; busy: boolean;
}

/** Read-only contact row; "change" opens a bottom sheet holding the request/verify flow. */
export function EmployeeContactRow({ channel, currentValue, request, verify, busy }: Props) {
  const { t } = useTranslation();
  const dir = useDir();
  const colors = useSawaaColors();
  const insets = useSafeAreaInsets();
  const { scheme } = useTheme();
  const roles = getSawaaRoles(scheme);
  const reduceMotion = useReduceMotion();
  const { height } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const [updated, setUpdated] = useState(false);
  const Icon = channel === 'EMAIL' ? Mail : Phone;
  const label = t(channel === 'EMAIL' ? 'settings.email' : 'settings.phone');
  const close = () => setOpen(false);
  return <View style={styles.wrap}>
    <View style={[styles.row, { flexDirection: dir.row }]}>
      <Icon size={20} color={colors.teal[700]} strokeWidth={1.75} />
      <View style={styles.main}>
        <ThemedText variant="caption" style={{ textAlign: dir.textAlign }}>{label}</ThemedText>
        <ThemedText style={styles.value} numberOfLines={1}>{currentValue ?? '—'}</ThemedText>
      </View>
      <Pill label={t(currentValue ? 'employeeSelfProfile.verified' : 'employeeSelfProfile.notAdded')} tone={currentValue ? 'brand' : 'muted'} />
      <AppButton label={t('employeeSelfProfile.change')} variant="secondary" size="sm" disabled={busy}
        accessibilityLabel={`${t('employeeSelfProfile.change')} ${label}`} onPress={() => { setUpdated(false); setOpen(true); }} />
    </View>
    {updated ? <ThemedText variant="bodySm" accessibilityLiveRegion="polite" style={{ textAlign: dir.textAlign }}>{t('employeeSelfProfile.contactUpdated')}</ThemedText> : null}
    <Modal visible={open} transparent animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.backdrop, { backgroundColor: roles.scrim }]}>
        <Pressable testID="contact-sheet-backdrop" accessible={false} style={StyleSheet.absoluteFill} onPress={busy ? undefined : close} />
        <View accessibilityViewIsModal style={[styles.sheet, { maxHeight: height - insets.top }]}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + sawaaSpacing.lg }]}>
            <View style={styles.handle} />
            <ThemedText accessibilityRole="header" variant="subheading" style={styles.title}>{t(channel === 'EMAIL' ? 'employeeSelfProfile.changeEmailTitle' : 'employeeSelfProfile.changePhoneTitle')}</ThemedText>
            <View style={styles.stretch}>
              <EmployeeContactEditor channel={channel} currentValue={currentValue} request={request} verify={verify} busy={busy}
                onVerified={() => { setOpen(false); setUpdated(true); }} />
            </View>
            <AppButton variant="secondary" tone="neutral" label={t('common.cancel')} onPress={close} disabled={busy} style={styles.stretch} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </View>;
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  wrap: { gap: sawaaSpacing.xs },
  row: { alignItems: 'center', gap: sawaaSpacing.sm },
  main: { flex: 1, minWidth: 0 },
  value: { textAlign: 'left', writingDirection: 'ltr' },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.glass.opaqueBg, borderTopLeftRadius: sawaaRadius.xl, borderTopRightRadius: sawaaRadius.xl },
  content: { paddingHorizontal: sawaaSpacing.lg, paddingTop: sawaaSpacing.md, alignItems: 'center', gap: sawaaSpacing.md },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.ink[400], marginBottom: 6 },
  title: { textAlign: 'center' },
  stretch: { alignSelf: 'stretch' },
});
