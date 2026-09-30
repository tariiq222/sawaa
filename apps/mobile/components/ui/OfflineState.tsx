import React from 'react';
import { WifiOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { StateMessage } from './StateMessage';

interface OfflineStateProps {
  title?: string;
  description?: string;
  /** Retry handler; the button is hidden when omitted. */
  onRetry?: () => void;
  retryLabel?: string;
}

/**
 * No-connection state: amber circle, title, description and a retry button.
 * Presentational only; it does not detect connectivity, the screen decides when to show it.
 */
export function OfflineState({ title, description, onRetry, retryLabel }: OfflineStateProps) {
  const { t } = useTranslation();
  return (
    <StateMessage
      icon={WifiOff}
      tone="offline"
      title={title ?? t('common.offlineTitle')}
      description={description ?? t('common.offlineDescription')}
      primaryAction={onRetry ? { label: retryLabel ?? t('common.retry'), onPress: onRetry } : undefined}
    />
  );
}
