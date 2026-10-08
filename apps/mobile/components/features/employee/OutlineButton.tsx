import React from 'react';
import { ActionButton, type ActionButtonProps } from '@/theme/sawaa/ActionButton';

/** Employee secondary action; defaults to brand tone and accepts optional neutral tone. */
export function OutlineButton(props: ActionButtonProps) {
  return <ActionButton {...props} variant="outline" />;
}
