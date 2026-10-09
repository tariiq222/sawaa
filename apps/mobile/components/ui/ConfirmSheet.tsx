import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LucideIcon } from 'lucide-react-native';

import { AppButton } from '@/components/ui/AppButton';
import { LabeledInput } from '@/components/ui/LabeledInput';
import { ThemedText } from '@/theme/components/ThemedText';
import { useTheme } from '@/theme/useTheme';
import { useDir } from '@/hooks/useDir';
import { useReduceMotion } from '@/hooks/useA11y';
import { getSawaaRoles, sawaaRadius, sawaaSpacing, withAlpha } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

export interface ConfirmSheetProps {
  visible: boolean;
  icon: LucideIcon;
  title: string;
  body: string;
  /** Bulleted consequences shown under the body. */
  points?: string[];
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  tone?: 'danger' | 'primary';
  busy?: boolean;
  /**
   * When set, the confirm action stays disabled until the user types this
   * exact word. Used for irreversible actions such as closing the account.
   */
  confirmPhrase?: string;
  confirmPhraseLabel?: string;
}

/** The single bottom-sheet confirmation used for consequential actions. */
export function ConfirmSheet({
  visible, icon: Icon, title, body, points, confirmLabel, cancelLabel, onConfirm, onCancel,
  tone = 'danger', busy, confirmPhrase, confirmPhraseLabel,
}: ConfirmSheetProps) {
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const { scheme } = useTheme();
  const roles = getSawaaRoles(scheme);
  const reduceMotion = useReduceMotion();
  const { height } = useWindowDimensions();
  const [typed, setTyped] = useState('');
  const tint = tone === 'danger' ? colors.accent.coral : colors.teal[700];

  // Every opening starts from an empty confirmation field.
  useEffect(() => { if (!visible) setTyped(''); }, [visible]);

  const phraseMatches = !confirmPhrase || typed.trim() === confirmPhrase;

  return (
    <Modal visible={visible} transparent animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.backdrop, { backgroundColor: roles.scrim }]}>
        <Pressable testID="confirm-sheet-backdrop" accessible={false} style={StyleSheet.absoluteFill} onPress={busy ? undefined : onCancel} />
        <View accessibilityViewIsModal style={[styles.sheet, { maxHeight: height - insets.top }]}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + sawaaSpacing.lg }]}>
            <View style={styles.handle} />
            <View style={[styles.iconCircle, { backgroundColor: withAlpha(tint, 0.16) }]}>
              <Icon size={30} color={tint} strokeWidth={1.75} />
            </View>
            <ThemedText accessibilityRole="header" variant="subheading" style={styles.center}>{title}</ThemedText>
            <ThemedText variant="body" style={styles.center}>{body}</ThemedText>
            {points?.length ? (
              <View style={styles.points}>
                {points.map((point) => (
                  <View key={point} style={[styles.point, { flexDirection: dir.row }]}>
                    <View style={[styles.dot, { backgroundColor: tint }]} />
                    <ThemedText variant="body" style={[styles.pointText, { textAlign: dir.textAlign }]}>{point}</ThemedText>
                  </View>
                ))}
              </View>
            ) : null}
            {confirmPhrase ? (
              <View style={styles.stretch}>
                <LabeledInput
                  label={confirmPhraseLabel ?? confirmPhrase}
                  value={typed}
                  onChangeText={setTyped}
                  autoCapitalize="none"
                  autoCorrect={false}
                  disabled={busy}
                  accessibilityLabel={confirmPhraseLabel ?? confirmPhrase}
                  dir={dir}
                />
              </View>
            ) : null}
            <AppButton variant={tone === 'danger' ? 'danger' : 'primary'} label={confirmLabel} onPress={onConfirm}
              disabled={!phraseMatches} loading={busy} style={styles.stretch} />
            <AppButton variant="secondary" tone="neutral" label={cancelLabel} onPress={onCancel} disabled={busy} style={styles.stretch} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.glass.opaqueBg, borderTopLeftRadius: sawaaRadius.xl, borderTopRightRadius: sawaaRadius.xl },
  content: { paddingHorizontal: sawaaSpacing.lg, paddingTop: sawaaSpacing.md, alignItems: 'center', gap: sawaaSpacing.md },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.ink[400], marginBottom: 6 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  points: { alignSelf: 'stretch', gap: sawaaSpacing.sm },
  point: { alignItems: 'flex-start', gap: sawaaSpacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 9 },
  pointText: { flex: 1, minWidth: 0 },
  stretch: { alignSelf: 'stretch' },
});
