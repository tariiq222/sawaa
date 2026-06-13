import React, { useEffect } from 'react';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useReduceMotion } from '@/hooks/useA11y';
import { sawaaColors, sawaaRadius, withAlpha } from '@/theme/sawaa/tokens';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

const FILL = withAlpha(sawaaColors.teal[900], 0.08);
const PULSE_MS = 1100;
const OPACITY_LOW = 0.45;
const OPACITY_HIGH = 0.9;
const STATIC_OPACITY = 0.6;

/**
 * Pulsing placeholder block for loading states. Opacity-only animation
 * (reanimated, ease-out cubic); renders static when reduce-motion is on.
 */
export function Skeleton({
  width = '100%',
  height = 16,
  radius = sawaaRadius.md,
  style,
}: SkeletonProps) {
  const reduceMotion = useReduceMotion();
  const opacity = useSharedValue(OPACITY_HIGH);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = STATIC_OPACITY;
      return;
    }
    opacity.value = OPACITY_HIGH;
    opacity.value = withRepeat(
      withTiming(OPACITY_LOW, { duration: PULSE_MS, easing: Easing.out(Easing.cubic) }),
      -1,
      true,
    );
  }, [reduceMotion, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radius, backgroundColor: FILL }, animatedStyle, style]}
    />
  );
}
