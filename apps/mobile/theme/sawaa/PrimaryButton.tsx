import React from 'react';
import { ActionButton, type ActionButtonProps } from './ActionButton';

/** Primary pill action; accepts the shared loading and accessibility contract. */
export function PrimaryButton(props: ActionButtonProps) {
  return <ActionButton {...props} variant="primary" />;
}
