import React from 'react';
import { Building2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useDir } from '@/hooks/useDir';
import type { ClinicEntry } from '@/lib/clinics';

import { DirectoryCard } from './DirectoryCard';

/** Localised clinic name and short description. */
export function clinicDisplay(clinic: ClinicEntry, isRTL: boolean) {
  const name = isRTL ? clinic.nameAr : (clinic.nameEn ?? clinic.nameAr);
  const description = (isRTL ? clinic.descriptionAr : (clinic.descriptionEn ?? clinic.descriptionAr)) ?? null;
  return { name, description };
}

/** Case-insensitive search over a clinic's Arabic and English names. */
export function filterClinics(clinics: readonly ClinicEntry[], query: string): ClinicEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...clinics];
  return clinics.filter((clinic) =>
    clinic.nameAr.toLowerCase().includes(q) || (clinic.nameEn ?? '').toLowerCase().includes(q));
}

/**
 * Clinic list card. Practitioner and service counts are real fields of the
 * clinic directory; branch, hours and ratings have no data and are not shown.
 */
export function ClinicCard({ clinic, onPress }: { clinic: ClinicEntry; onPress: () => void }) {
  const { t } = useTranslation();
  const dir = useDir();
  const { name, description } = clinicDisplay(clinic, dir.isRTL);
  const pills = [
    { label: t('clinics.therapistsCount', { count: clinic.therapistCount }) },
    ...(clinic.serviceCount > 0 ? [{ label: t('clinics.servicesCount', { count: clinic.serviceCount }) }] : []),
  ];
  return (
    <DirectoryCard
      title={name}
      subtitle={description}
      imageUri={clinic.imageUrl}
      placeholderIcon={Building2}
      pills={pills}
      accessibilityLabel={`${name}, ${pills.map((pill) => pill.label).join(', ')}`}
      onPress={onPress}
      testID={`clinic-${clinic.id}`}
    />
  );
}
