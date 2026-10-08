import React from 'react';
import { ViewStyle } from 'react-native';
import { AppButton } from '@/components/ui/AppButton';
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
interface ThemedButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  full?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}
/** @deprecated Retained as an AppButton adapter for existing imports and ReactNode labels. */
export function ThemedButton({ children, variant = 'primary', full, style, ...props }: ThemedButtonProps) {
  return <AppButton {...props} label={children} variant={variant === 'outline' ? 'secondary' : variant}
    style={[full ? { width: '100%' } : undefined, style]} />;
}
