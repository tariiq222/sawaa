import React from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import type { ComponentProps } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { AppButton } from './AppButton';
import {
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

const ICON_SIZE = 44;
const CIRCLE_SIZE = 96;
const DESCRIPTION_MAX_WIDTH = 290;

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
  const sawaaColors = useSawaaColors();
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
          backgroundColor: withAlpha(accentColor, 0.14),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={ICON_SIZE} color={accentColor} />
      </View>
      <Text
        style={{
          fontSize: 22,
          lineHeight: 30,
          fontFamily: getFontName(locale, '700'),
          fontWeight: '700',
          marginTop: sawaaSpacing.xs,
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
            fontSize: 15,
            lineHeight: 24,
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
        <AppButton label={actionLabel} onPress={onAction} variant="secondary" style={{ marginTop: sawaaSpacing.sm }} />
      ) : null}
    </View>
  );
}
