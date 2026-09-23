import React from 'react';
import { Pressable, View, ViewStyle } from 'react-native';
import { useTheme } from '../useTheme';
import { withAlpha } from '../sawaa/tokens';

interface ThemedCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  elevation?: 'none' | 'sm' | 'md' | 'lg';
  padding?: number;
  selected?: boolean;
  onPress?: () => void;
}

/**
 * DS Rule: No borders on standard cards.
 * White cards on gray background create hierarchy via tonal shifts.
 * Selected state = faint blue tint + subtle border.
 */
export function ThemedCard({
  children,
  style,
  elevation = 'none',
  padding = 16,
  selected,
  onPress,
}: ThemedCardProps) {
  const { theme } = useTheme();

  const cardStyle: ViewStyle = {
    backgroundColor: selected ? withAlpha(theme.colors.primary, 0.05) : theme.colors.white,
    borderRadius: 12,
    padding,
    borderWidth: selected ? 1.5 : 0,
    borderColor: selected ? withAlpha(theme.colors.primary, 0.3) : 'transparent',
    ...theme.shadows[elevation],
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: Boolean(selected) }}
        style={({ pressed }) => [
          cardStyle,
          { transform: [{ scale: pressed ? 0.98 : 1 }] },
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[cardStyle, style]}>{children}</View>;
}
