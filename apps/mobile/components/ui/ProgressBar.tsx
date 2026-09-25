import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useReduceMotion } from '@/hooks/useA11y';
import { useDir } from '@/hooks/useDir';
import { sawaaRadius, withAlpha } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

interface ProgressBarProps {
  /** Fraction of completion, clamped to 0..1. */
  progress: number;
  height?: number;
}

const ANIMATION_MS = 350;

/**
 * Determinate progress bar. The fill anchors to the logical start edge
 * (grows from the right in Arabic) and animates width via reanimated;
 * jumps instantly when reduce-motion is on.
 */
export function ProgressBar({ progress, height = 4 }: ProgressBarProps) {
  const sawaaColors = useSawaaColors();
  const trackFill = withAlpha(sawaaColors.teal[700], 0.12);
  const { alignStart } = useDir();
  const reduceMotion = useReduceMotion();
  const clamped = Math.min(1, Math.max(0, progress));
  const fraction = useSharedValue(clamped);

  useEffect(() => {
    if (reduceMotion) {
      fraction.value = clamped;
      return;
    }
    fraction.value = withTiming(clamped, {
      duration: ANIMATION_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [clamped, reduceMotion, fraction]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fraction.value * 100}%`,
  }));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 1, now: clamped }}
      style={{
        height,
        borderRadius: sawaaRadius.pill,
        backgroundColor: trackFill,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={[
          {
            height: '100%',
            borderRadius: sawaaRadius.pill,
            backgroundColor: sawaaColors.teal[500],
            alignSelf: alignStart,
          },
          fillStyle,
        ]}
      />
    </View>
  );
}
