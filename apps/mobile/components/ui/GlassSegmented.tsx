import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Glass } from '@/theme/components/Glass';
import { useTheme } from '@/theme/useTheme';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { sawaaRadius, sawaaSpacing, sawaaType, withAlpha } from '@/theme/sawaa';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  /** Optional count shown beside the label, e.g. unread notifications. */
  badge?: string;
};

/**
 * Shared segmented control for in-page selectors. Appointments opt into the
 * lighter navigation appearance; settings and filters retain the default fill.
 */
export function GlassSegmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  appearance = 'default',
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  appearance?: 'default' | 'navigation';
}) {
  const { theme, scheme } = useTheme();
  const colors = useSawaaColors();
  const dir = useDir();
  const f600 = getFontName(dir.locale, '600');
  const styles = createStyles(colors, size);
  // A neutral grey rail reads as foreign on the aqua page; use the same
  // teal tint as the brand pills in light mode. The dark rail is already teal-toned.
  const railColor = scheme === 'dark' ? theme.colors.surfaceHigh : withAlpha(colors.teal[500], 0.14);

  return (
    <Glass variant={appearance === 'navigation' ? 'strong' : 'regular'} radius={sawaaRadius.pill}>
      <View
        style={[
          styles.track,
          { flexDirection: dir.row, backgroundColor: railColor },
        ]}
      >
        {options.map((option) => {
          const isActive = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => {
                if (isActive) return;
                onChange(option.value);
              }}
              style={[styles.tab, { flexDirection: dir.row }, isActive && { backgroundColor: theme.colors.primarySelection }]}
              accessibilityRole="tab"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: isActive }}
            >
              <Text
                style={[
                  styles.label,
                  {
                    fontFamily: f600,
                    writingDirection: dir.writingDirection,
                    color: isActive
                      ? theme.colors.primarySelectionForeground
                      : colors.ink[700],
                  },
                ]}
              >
                {option.label}
              </Text>
              {option.badge !== undefined ? (
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: isActive
                        ? theme.colors.primarySelectionForeground
                        : theme.colors.surface,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      {
                        fontFamily: f600,
                        writingDirection: dir.writingDirection,
                        color: isActive ? theme.colors.primarySelection : colors.ink[500],
                      },
                    ]}
                  >
                    {option.badge}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </Glass>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>, size: 'sm' | 'md') =>
  StyleSheet.create({
    // The rail carries its own surface: glass alone is invisible on a white card.
    track: {
      padding: sawaaSpacing.xs,
      gap: sawaaSpacing.xs,
      borderRadius: sawaaRadius.pill,
    },
    tab: {
      flex: 1,
      minWidth: 0,
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: sawaaSpacing.xs,
      paddingVertical: size === 'md' ? sawaaSpacing.md : sawaaSpacing.sm,
      paddingHorizontal: sawaaSpacing.md,
      borderRadius: sawaaRadius.pill,
      overflow: 'hidden',
    },
    label: {
      flexShrink: 1,
      minWidth: 0,
      textAlign: 'center',
      fontSize: size === 'md' ? sawaaType.body.fontSize : sawaaType.caption.fontSize,
      lineHeight: size === 'md' ? sawaaType.body.lineHeight : sawaaType.caption.lineHeight,
    },
    badge: {
      flexShrink: 0,
      minWidth: 18,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: sawaaRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: { fontSize: sawaaType.micro.fontSize, lineHeight: sawaaType.micro.lineHeight },
  });
