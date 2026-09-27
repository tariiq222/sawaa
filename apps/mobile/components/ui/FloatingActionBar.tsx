import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDir } from '@/hooks/useDir';
import { Glass } from '@/theme/components/Glass';
import type { GlassVariant } from '@/theme/components/Glass';
import { sawaaRadius, sawaaSpacing } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

interface FloatingActionBarProps {
  children: React.ReactNode;
  variant?: GlassVariant;
  allowOverflow?: boolean;
  opaqueBackdrop?: boolean;
}

/**
 * Bottom-floating action container for tab-bar-less screens. Lays children
 * out in a logical row inside a strong glass surface; callers control each
 * child's flex.
 */
export function FloatingActionBar({ children, variant = 'strong', allowOverflow = false, opaqueBackdrop = false }: FloatingActionBarProps) {
  const insets = useSafeAreaInsets();
  const { row } = useDir();
  const colors = useSawaaColors();

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        start: sawaaSpacing.lg,
        end: sawaaSpacing.lg,
        bottom: insets.bottom + sawaaSpacing.lg,
      }}
    >
      <Glass variant={variant} radius={sawaaRadius.xl} padding={sawaaSpacing.md}
        style={{
          ...(allowOverflow ? { overflow: 'visible' as const } : {}),
          ...(opaqueBackdrop ? { backgroundColor: colors.glass.opaqueBg } : {}),
        }}>
        <View
          style={{
            flexDirection: row,
            alignItems: 'center',
            gap: sawaaSpacing.md,
          }}
        >
          {children}
        </View>
      </Glass>
    </View>
  );
}
