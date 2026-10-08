import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

export function HomeSectionState({ loading, error, hasData, onRetry, children }: {
  loading: boolean; error: boolean; hasData: boolean; onRetry: () => void; children: React.ReactNode;
}) {
  const { t } = useTranslation();
  if (loading && !hasData) return <Skeleton height={96} />;
  if (!error && !hasData) return null;
  return <View>{hasData ? children : null}{error ? <EmptyState icon="cloud-offline-outline" tone="danger" title={t('home.sectionLoadError')} actionLabel={t('common.retry')} onAction={onRetry} /> : null}</View>;
}
