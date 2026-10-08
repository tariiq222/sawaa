import React from 'react';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { ActionButton, type ActionButtonProps } from '@/theme/sawaa/ActionButton';

/** Outlined capsule for the less prominent of two actions. */
export function SecondaryButton(props: ActionButtonProps) {
  const dir = useDir();
  return <ActionButton fontFamily={getFontName(dir.locale, '700')} {...props} variant="outline" />;
}
