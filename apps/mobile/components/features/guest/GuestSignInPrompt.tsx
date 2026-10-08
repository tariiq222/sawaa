import React from 'react';
import { View } from 'react-native';
import { CalendarDays } from 'lucide-react-native';
import { Glass } from '@/theme/components/Glass';
import { ThemedText } from '@/theme/components/ThemedText';
import { AppButton } from '@/components/ui/AppButton';
import { useDir } from '@/hooks/useDir';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { sawaaRadius, sawaaSpacing } from '@/theme/sawaa/tokens';

/** Shared presentation only: callers own the destination and action hierarchy. */
export function GuestSignInPrompt({ title, description, actionLabel, onPress, variant = 'primary' }: {
  title?: string; description: string; actionLabel: string; onPress: () => void; variant?: 'primary' | 'secondary';
}) {
  const colors = useSawaaColors();
  const dir = useDir();
  return <Glass variant="strong" radius={sawaaRadius.lg} style={{ padding: sawaaSpacing.lg, gap: sawaaSpacing.md }}>
    <View style={{ flexDirection: dir.row, alignItems: 'center', gap: sawaaSpacing.sm }}>
      <CalendarDays size={30} color={colors.teal[700]} />
      {title && <ThemedText variant="subheading" style={{ flex: 1, minWidth: 0, flexShrink: 1 }}>{title}</ThemedText>}
    </View>
    <ThemedText variant="body">{description}</ThemedText>
    <AppButton label={actionLabel} variant={variant} onPress={onPress} />
  </Glass>;
}
