import React from 'react';
import { Pressable, View, ViewStyle } from 'react-native';
import { useTheme } from '../useTheme';
import { sawaaRadius } from '../sawaa/tokens';

interface ThemedCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  elevation?: 'none' | 'sm' | 'md' | 'lg';
  padding?: number;
  selected?: boolean;
  onPress?: () => void;
}

/**
 * Shared opaque content card. Selected state uses the semantic selection
 * foreground and a clear outline instead of a faint translucent tint.
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
    backgroundColor: theme.colors.surface,
    borderRadius: sawaaRadius.lg,
    padding,
    borderWidth: selected ? 2 : 0,
    borderColor: selected ? theme.colors.primarySelection : 'transparent',
    ...(elevation === 'none' ? {} : theme.shadows[elevation]),
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
