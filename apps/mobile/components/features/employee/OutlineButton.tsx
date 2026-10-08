import React from 'react';
import { AppButton } from '@/components/ui/AppButton';
interface OutlineButtonProps {
  label: string;
  onPress: () => void;
  icon?: React.ReactNode;
  tone?: 'brand' | 'neutral';
  disabled?: boolean;
  loading?: boolean;
}
export function OutlineButton(props: OutlineButtonProps) {
  return <AppButton {...props} variant="secondary" />;
}
