import React from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import { Glass } from '@/theme/components/Glass';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useDir } from '@/hooks/useDir';

export function BackButton({
  onPress,
  style,
  testID,
  accessibilityLabel,
}: {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const { t } = useTranslation();
  const colors = useSawaaColors();
  const dir = useDir();
  const Icon = dir.isRTL ? ChevronRight : ChevronLeft;

  return (
    <Glass
      variant="strong"
      radius={22}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? t('a11y.buttonBack')}
      testID={testID}
      style={[styles.button, { backgroundColor: colors.glass.opaqueBg }, style]}
    >
      <Icon size={22} color={colors.ink[700]} strokeWidth={1.75} />
    </Glass>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
});
