import React from 'react';
import type { LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useDir } from '@/hooks/useDir';
import type { ClinicEntry } from '@/lib/clinics';

import { clinicDisplay } from './ClinicCard';
import { ProfileHero } from './ProfileHero';

/** Clinic profile header. Counts are real; branch, hours and ratings have no data and are not shown. */
export function ClinicProfileHeader({ clinic, placeholderIcon }: { clinic: ClinicEntry; placeholderIcon: LucideIcon }) {
  const { t } = useTranslation();
  const dir = useDir();
  const { name } = clinicDisplay(clinic, dir.isRTL);
  return (
    <ProfileHero
      name={name}
      imageUri={clinic.imageUrl}
      placeholderIcon={placeholderIcon}
      pills={[
        { label: t('clinics.therapistsCount', { count: clinic.therapistCount }) },
        ...(clinic.serviceCount > 0 ? [{ label: t('clinics.servicesCount', { count: clinic.serviceCount }) }] : []),
      ]}
    />
  );
}
