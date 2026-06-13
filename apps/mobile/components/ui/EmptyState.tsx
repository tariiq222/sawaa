import React from 'react';
import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { GlassSurface } from '@/theme/sawaa/GlassSurface';
import {
  sawaaColors,
  sawaaRadius,
  sawaaSpacing,
  sawaaType,
  withAlpha,
} from '@/theme/sawaa/tokens';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

interface EmptyStateProps {
  icon: IoniconName;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'default' | 'danger';
}

const ICON_SIZE = 28;
const CIRCLE_SIZE = 56;
const DESCRIPTION_MAX_WIDTH = 280;

/**
 * Centered block for empty/error states. Purely presentational —
 * all strings (already localized) are passed in by the caller.
 */
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  tone = 'default',
}: EmptyStateProps) {
  const { locale, writingDirection } = useDir();
  const accentColor = tone === 'danger' ? sawaaColors.accent.coral : sawaaColors.teal[700];

  return (
    <View
      style={{
        alignItems: 'center',
        paddingVertical: sawaaSpacing['3xl'],
        gap: sawaaSpacing.sm,
      }}
    >
      <View
        style={{
          width: CIRCLE_SIZE,
          height: CIRCLE_SIZE,
          borderRadius: sawaaRadius.pill,
          backgroundColor: withAlpha(accentColor, 0.08),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={ICON_SIZE} color={accentColor} />
      </View>
      <Text
        style={{
          fontSize: sawaaType.subheading.fontSize,
          lineHeight: sawaaType.subheading.lineHeight,
          fontFamily: getFontName(locale, sawaaType.subheading.weight),
          fontWeight: sawaaType.subheading.weight,
          color: sawaaColors.ink[900],
          textAlign: 'center',
          writingDirection,
        }}
      >
        {title}
      </Text>
      {description ? (
        <Text
          style={{
            fontSize: sawaaType.body.fontSize,
            lineHeight: sawaaType.body.lineHeight,
            fontFamily: getFontName(locale, sawaaType.body.weight),
            fontWeight: sawaaType.body.weight,
            color: sawaaColors.ink[500],
            textAlign: 'center',
            writingDirection,
            maxWidth: DESCRIPTION_MAX_WIDTH,
          }}
        >
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={{ marginTop: sawaaSpacing.sm }}
        >
          <GlassSurface variant="strong" radius={sawaaRadius.pill}>
            <View
              style={{
                paddingHorizontal: sawaaSpacing.lg,
                paddingVertical: sawaaSpacing.sm,
              }}
            >
              <Text
                style={{
                  fontSize: sawaaType.body.fontSize,
                  lineHeight: sawaaType.body.lineHeight,
                  fontFamily: getFontName(locale, '600'),
                  fontWeight: '600',
                  color: sawaaColors.teal[700],
                  writingDirection,
                }}
              >
                {actionLabel}
              </Text>
            </View>
          </GlassSurface>
        </Pressable>
      ) : null}
    </View>
  );
}
