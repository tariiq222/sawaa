import React from 'react';
import { useLocalSearchParams } from 'expo-router';

import { GroupDetailsStep } from '@/components/features/groups/GroupDetailsStep';

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <GroupDetailsStep id={id} />;
}
