import React from 'react';
import { Switch } from 'react-native';

import { useTheme } from '@/theme/useTheme';

/**
 * The single on/off switch used across the app. It keeps the native control
 * (platform gesture, haptics and accessibility) but takes its four colours from
 * the `switch` role, so an off switch stays visible on every surface and in both
 * appearances instead of inheriting an invisible track.
 */
export function GlassSwitch({
  value,
  onValueChange,
  disabled,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const { theme } = useTheme();
  const palette = theme.colors.switch;

  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      trackColor={{ false: palette.trackOff, true: palette.trackOn }}
      thumbColor={value ? palette.thumbOn : palette.thumbOff}
      ios_backgroundColor={palette.trackOff}
    />
  );
}
