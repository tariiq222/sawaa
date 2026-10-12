import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Pencil } from 'lucide-react-native';

import { ThemedText } from '@/theme/components/ThemedText';
import { useDir } from '@/hooks/useDir';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { sawaaSpacing } from '@/theme/sawaa/tokens';

/** The email this attempt is using, with a pencil that returns to the email field to fix it. */
export function EditableEmail({ text, onEdit, ltr }: { text: string; onEdit: () => void; ltr?: boolean }) {
  const { t } = useTranslation();
  const dir = useDir();
  const colors = useSawaaColors();
  return (
    <View style={{ flexDirection: dir.row, alignItems: 'center', gap: sawaaSpacing.sm }}>
      <ThemedText variant="body" style={[{ flex: 1, minWidth: 0 }, ltr ? { writingDirection: 'ltr', textAlign: dir.textAlign } : null]}>{text}</ThemedText>
      <Pressable accessibilityRole="button" accessibilityLabel={t('auth.emailEntry.editEmail')} onPress={onEdit}
        hitSlop={8} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Pencil size={20} color={colors.teal[700]} />
      </Pressable>
    </View>
  );
}
