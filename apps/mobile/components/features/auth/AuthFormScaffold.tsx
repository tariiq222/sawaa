import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AquaBackground } from '@/theme/sawaa';
import { sawaaSpacing } from '@/theme/sawaa/tokens';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ThemedText } from '@/theme/components/ThemedText';

/** Safe padding and keyboard handling for auth content; navigation stays with callers. */
export function AuthFormScaffold({ children, title, onBack }: {
  children: React.ReactNode; title?: string; onBack?: () => void;
}) {
  const insets = useSafeAreaInsets();
  return <AquaBackground>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + sawaaSpacing.md, paddingBottom: insets.bottom + sawaaSpacing['2xl'] }]}>
        {onBack ? <ScreenHeader title={title ?? ''} onBack={onBack} /> : title ? <ThemedText accessibilityRole="header" variant="heading">{title}</ThemedText> : null}
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  </AquaBackground>;
}
const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: sawaaSpacing.lg, gap: sawaaSpacing.lg },
});
