import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppButton } from '@/components/ui/AppButton';
import { sawaaSpacing } from '@/theme/sawaa/tokens';
interface Props { enabled: boolean; pending: boolean; onPress: () => void; fontFamily: string }
export function PackageBookingAction({ enabled, pending, onPress }: Props) {
  const { t } = useTranslation();
  return <AppButton label={t('packages.confirmBooking')} loading={pending} disabled={!enabled} onPress={onPress} style={{ marginTop: sawaaSpacing.lg }} />;
}
