import React from 'react';
import { Platform } from 'react-native';
import { SymbolView } from 'expo-symbols';
import type { SymbolViewProps } from 'expo-symbols';
import type { LucideIcon } from 'lucide-react-native';

interface AppIconProps {
  /** SF Symbol name used on iOS. */
  sf: SymbolViewProps['name'];
  /** Lucide icon rendered on Android/web. */
  fallback: LucideIcon;
  size?: number;
  color: string;
  strokeWidth?: number;
}

export function AppIcon({ sf, fallback: Fallback, size = 20, color, strokeWidth = 1.7 }: AppIconProps) {
  if (Platform.OS === 'ios') {
    return <SymbolView name={sf} tintColor={color} size={size} />;
  }
  return <Fallback size={size} color={color} strokeWidth={strokeWidth} />;
}
