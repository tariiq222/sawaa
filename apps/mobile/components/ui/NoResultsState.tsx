import React from 'react';
import { SearchX } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { StateMessage } from './StateMessage';

interface NoResultsStateProps {
  title?: string;
  description?: string;
  /** Clears the active search or filter; the button is hidden when omitted. */
  onClear?: () => void;
  clearLabel?: string;
}

/** Empty search result: teal-tinted circle, title, hint and an outlined clear button. */
export function NoResultsState({ title, description, onClear, clearLabel }: NoResultsStateProps) {
  const { t } = useTranslation();
  return (
    <StateMessage
      icon={SearchX}
      tone="neutral"
      title={title ?? t('common.noResults')}
      description={description ?? t('common.noResultsDescription')}
      secondaryAction={onClear ? { label: clearLabel ?? t('common.clearSearch'), onPress: onClear } : undefined}
    />
  );
}
