import React from 'react';
import { CircleAlert } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { StateMessage } from './StateMessage';

interface ErrorStateProps {
  title?: string;
  description?: string;
  /** Retry handler; the button is hidden when omitted. */
  onRetry?: () => void;
  retryLabel?: string;
}

/** Load-failure state: coral circle, title, description and a retry button. */
export function ErrorState({ title, description, onRetry, retryLabel }: ErrorStateProps) {
  const { t } = useTranslation();
  return (
    <StateMessage
      icon={CircleAlert}
      tone="error"
      title={title ?? t('common.error')}
      description={description ?? t('common.errorDescription')}
      primaryAction={onRetry ? { label: retryLabel ?? t('common.tryAgain'), onPress: onRetry } : undefined}
    />
  );
}
