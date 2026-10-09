import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { AquaBackground } from '@/theme/sawaa';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { sawaaSpacing } from '@/theme/sawaa';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { goBackOrHome } from '@/lib/navigation';

/**
 * Shared chrome for every client settings page: surface background, safe-area
 * scroll and a labelled back control. Each settings route passes its own title so
 * the page itself states which purpose it serves.
 */
export function SettingsScaffold({
  title,
  children,
  keyboardSafe = false,
}: {
  title: string;
  children: React.ReactNode;
  keyboardSafe?: boolean;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scroll = (
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <ScreenHeader title={title} onBack={() => goBackOrHome(router, '/(client)/(tabs)/account')} />
        </View>
        {children}
      </ScrollView>
  );
  return <AquaBackground>{keyboardSafe ? <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>{scroll}</KeyboardAvoidingView> : scroll}</AquaBackground>;
}


const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: sawaaSpacing.lg },
  header: { marginBottom: sawaaSpacing.xl },
});
