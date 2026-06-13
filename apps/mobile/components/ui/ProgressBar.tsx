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
import { sawaaColors, sawaaRadius, withAlpha } from '@/theme/sawaa/tokens';

interface ProgressBarProps {
  /** Fraction of completion, clamped to 0..1. */
  progress: number;
  height?: number;
}

const TRACK_FILL = withAlpha(sawaaColors.teal[700], 0.12);
const ANIMATION_MS = 350;

/**
 * Determinate progress bar. The fill anchors to the logical start edge
 * (grows from the right in Arabic) and animates width via reanimated;
 * jumps instantly when reduce-motion is on.
 */
export function ProgressBar({ progress, height = 4 }: ProgressBarProps) {
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
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 1, now: clamped }}
      style={{
        height,
        borderRadius: sawaaRadius.pill,
        backgroundColor: TRACK_FILL,
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
