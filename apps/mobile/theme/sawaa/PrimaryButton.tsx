import React from 'react';
import { Text, ViewStyle } from 'react-native';
import { AppButton } from '@/components/ui/AppButton';

interface Props {
  label: string;
  onPress?: () => void;
  fontFamily?: string;
  style?: ViewStyle;
  height?: number;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}
/** Legacy primary API delegates rendering to the shared action. */
export function PrimaryButton({ label, fontFamily, height = 56, ...props }: Props) {
  return <AppButton {...props} minHeight={height} accessibilityLabel={label}
    label={fontFamily ? <Text style={{ fontFamily }}>{label}</Text> : label} />;
}
