import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useDir } from '@/hooks/useDir';
import { Glass } from '@/theme/components/Glass';
import { sawaaRadius } from '@/theme/sawaa/tokens';
import { Skeleton } from './Skeleton';

interface ListSkeletonProps {
  /** Number of placeholder cards. */
  count?: number;
}

const THUMB = 88;

/**
 * Loading placeholder for card lists (therapists, clinics): an 88 block plus three text lines
 * per card. Pulses through `Skeleton`, which holds still when reduce-motion is on.
 */
export function ListSkeleton({ count = 4 }: ListSkeletonProps) {
  const { row } = useDir();
  const { t } = useTranslation();
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={t('common.loading')} style={styles.list}>
      {Array.from({ length: count }, (_, i) => (
        <Glass key={i} radius={sawaaRadius.lg} padding={16}>
          <View testID="list-skeleton-card" style={[styles.card, { flexDirection: row }]}>
            <Skeleton width={THUMB} height={THUMB} radius={sawaaRadius.md} />
            <View style={styles.lines}>
              <Skeleton width="60%" height={18} radius={9} />
              <Skeleton width="40%" height={14} radius={7} />
              <Skeleton width="55%" height={26} radius={13} />
            </View>
          </View>
        </Glass>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  card: { gap: 12, alignItems: 'center' },
  lines: { flex: 1, gap: 10 },
});
