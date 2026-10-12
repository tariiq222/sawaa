import React from 'react';
import { Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MapPin, Phone } from 'lucide-react-native';

import { MenuGroup, type MenuEntry } from '@/components/ui/MenuGroup';
import { resolveDefaultBranch } from '@/features/packages/package-flow';
import { useBranding, usePublicBranch, usePublicBranches } from '@/hooks/queries';
import { openInMaps } from '@/lib/maps-link';

/**
 * Support rows shared by the client and guest account tabs: call the centre
 * (branding phone) and directions to it (main branch coordinates). Rows whose
 * data is missing are omitted; the whole card disappears when both are.
 */
export function CenterSupportSection() {
  const { t } = useTranslation();
  const contactPhone = useBranding().data?.contactPhone ?? null;
  const mainBranchId = resolveDefaultBranch(usePublicBranches().data)?.id;
  const branch = usePublicBranch(mainBranchId).data;
  const location = branch && branch.latitude != null && branch.longitude != null
    ? { latitude: branch.latitude, longitude: branch.longitude }
    : null;

  const entries: MenuEntry[] = [];
  if (contactPhone) {
    entries.push({
      key: 'crisis',
      icon: Phone,
      label: t('profile.crisisSupport.title'),
      description: t('profile.crisisSupport.subtitle'),
      value: contactPhone,
      valueDirection: 'ltr',
      onPress: () => { void Linking.openURL(`tel:${contactPhone}`); },
    });
  }
  if (location) {
    entries.push({
      key: 'directions',
      icon: MapPin,
      label: t('profile.directions.title'),
      description: t('profile.directions.subtitle'),
      onPress: () => { void openInMaps(location.latitude, location.longitude); },
    });
  }
  if (entries.length === 0) return null;
  return <MenuGroup title={t('profile.support')} entries={entries} />;
}
