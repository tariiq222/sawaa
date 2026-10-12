import React from 'react';
import { useLocalSearchParams } from 'expo-router';

import { PackageDetailsStep } from '@/components/features/packages/PackageDetailsStep';

export default function PackageFamilyDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <PackageDetailsStep familyId={id} />;
}
