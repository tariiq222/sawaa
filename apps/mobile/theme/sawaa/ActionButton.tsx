import React from 'react';
import { AppButton, type AppButtonProps } from '@/components/ui/AppButton';

/** Compatibility contract retained for latest resource, payment and employee actions. */
export interface ActionButtonProps extends Omit<AppButtonProps, 'label' | 'variant'> {
  label: string;
}
interface Props extends ActionButtonProps {
  variant?: 'primary' | 'outline' | 'soft' | 'destructive' | 'plain';
}
export function ActionButton({ variant = 'primary', ...props }: Props) {
  return <AppButton {...props} variant={variant === 'outline' ? 'secondary'
    : variant === 'destructive' ? 'danger' : variant === 'plain' ? 'ghost' : variant} />;
}
