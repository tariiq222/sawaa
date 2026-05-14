import { View, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/theme/components/ThemedText';
import { useTheme } from '@/theme/useTheme';
import type { QuickReply } from '@/types/chat';

interface ChatQuickActionsProps {
  quickReplies: QuickReply[];
  onPress: (action: string, label: string) => void;
}

export function ChatQuickActions({ quickReplies, onPress }: ChatQuickActionsProps) {
  const { isRTL, theme } = useTheme();

  if (quickReplies.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[
        styles.container,
        { flexDirection: isRTL ? 'row-reverse' : 'row' },
      ]}
    >
      {quickReplies.map((reply) => {
        const label = isRTL ? reply.label_ar : reply.label_en;
        return (
          <Pressable
            key={reply.action}
            onPress={() => onPress(reply.action, label)}
            style={[
              styles.chip,
              { borderColor: theme.colors.primary + '40', backgroundColor: theme.colors.primary + '10' },
            ]}
          >
            <ThemedText variant="caption" color={theme.colors.primary}>
              {label}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
});
