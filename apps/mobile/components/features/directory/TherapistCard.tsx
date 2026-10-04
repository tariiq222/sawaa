import React from 'react';
import { Banknote } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useDir } from '@/hooks/useDir';
import { formatCurrencyAmount } from '@/lib/currency-display';
import type { PublicEmployeeItem } from '@/services/client/employees';

import { DirectoryCard } from './DirectoryCard';

/** Localised display fields of a practitioner, shared by list, clinic and search surfaces. */
export function therapistDisplay(item: PublicEmployeeItem, isRTL: boolean, unknownName: string) {
  const name = (isRTL ? item.nameAr : item.nameEn) ?? item.nameEn ?? item.nameAr ?? unknownName;
  const specialty = (isRTL ? item.specialtyAr : item.specialty) ?? item.specialty ?? item.specialtyAr ?? null;
  const subtitle = [specialty, item.title].filter(Boolean).join(' · ') || null;
  return { name, specialty, subtitle };
}

interface TherapistCardProps {
  item: PublicEmployeeItem;
  onPress: () => void;
  /** Overrides `minServicePrice`: the price for the selected service; `null` hides the price. */
  servicePrice?: { price: number; currency: string } | null;
  /** Adds a separate «View profile» link (booking therapist step). */
  onViewProfile?: () => void;
  /** Hide price and availability (used where only identity matters, e.g. clinic practitioners). */
  compact?: boolean;
}

/**
 * Practitioner list card. Only real fields are shown: availability today and
 * the lowest service price. Delivery types and next-appointment times are not
 * part of the public directory payload, so they are not rendered.
 */
export function TherapistCard({ item, onPress, servicePrice, onViewProfile, compact = false }: TherapistCardProps) {
  const { t } = useTranslation();
  const dir = useDir();
  const { name, subtitle } = therapistDisplay(item, dir.isRTL, t('therapists.unknownName'));
  const price = servicePrice !== undefined
    ? servicePrice?.price
    : item.minServicePrice;
  const currency = servicePrice?.currency ?? 'SAR';
  const hasPrice = !compact && typeof price === 'number' && price > 0;
  return (
    <DirectoryCard
      title={name}
      subtitle={subtitle}
      imageUri={item.publicImageUrl}
      pills={!compact && item.isAvailableToday ? [{ label: t('therapists.availableToday') }] : []}
      meta={hasPrice
        ? { icon: Banknote, text: t('therapists.fromPrice', { price: formatCurrencyAmount(price as number, currency, dir.isRTL) }) }
        : null}
      onPress={onPress}
      secondaryAction={onViewProfile ? { label: t('therapists.viewProfile'), onPress: onViewProfile } : null}
      testID={`therapist-${item.id}`}
    />
  );
}
