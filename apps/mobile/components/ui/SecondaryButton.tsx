import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { AppButton } from './AppButton';
interface SecondaryButtonProps {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  height?: number;
  style?: StyleProp<ViewStyle>;
}
export function SecondaryButton({ height = 56, ...props }: SecondaryButtonProps) {
  return <AppButton {...props} variant="secondary" minHeight={height} />;
}
