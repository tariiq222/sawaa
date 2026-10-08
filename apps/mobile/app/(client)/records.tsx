import React, { useCallback, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AquaBackground, sawaaType } from '@/theme/sawaa';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useDir } from '@/hooks/useDir';
import { useReduceMotion } from '@/hooks/useA11y';
import { getFontName } from '@/theme/fonts';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { RecordCard } from '@/components/features/records/RecordCard';
import { useClientBookings } from '@/hooks/queries';
import { goBackOrHome } from '@/lib/navigation';

// The service layer uppercases status for the backend's Prisma enum.
const COMPLETED_PARAMS = { status: 'completed', limit: 50 } as const;

export default function RecordsScreen() {
  const colors = useSawaaColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const reduceMotion = useReduceMotion();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const { data, isPending, isError, refetch } = useClientBookings({ ...COMPLETED_PARAMS, page });
  const items = data?.items ?? [];
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refetch(); } finally { setRefreshing(false); }
  }, [refetch]);

  return (
    <AquaBackground>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal[600]} />}
      >
        <ScreenHeader title={t('records.title')} onBack={() => goBackOrHome(router, '/(client)/(tabs)/account')} />
        <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(600).easing(Easing.out(Easing.cubic))}>
          <Text style={{ fontFamily: getFontName(dir.locale, '400'), fontSize: sawaaType.bodySm.fontSize, lineHeight: sawaaType.bodySm.lineHeight, color: colors.ink[500], textAlign: dir.textAlign }}>{t('records.subtitle')}</Text>
        </Animated.View>
        {isPending ? (
          <View style={styles.skeletons}>{[0, 1, 2].map((index) => <Skeleton key={index} height={110} />)}</View>
        ) : isError ? (
          <ErrorState title={t('records.loadError')} retryLabel={t('common.retry')} onRetry={() => void refetch()} />
        ) : items.length === 0 ? (
          <EmptyState icon="calendar-outline" title={t('records.empty')} description={t('records.emptyHint')} />
        ) : items.map((booking, index) => (
          <RecordCard key={booking.id} booking={booking} index={index} onPress={() => router.push(`/(client)/appointment/${booking.id}`)} />
        ))}
        <PaginationControls page={page} totalPages={data?.meta?.totalPages ?? page} onPageChange={(nextPage) => { setPage(nextPage); scrollRef.current?.scrollTo({ y: 0, animated: !reduceMotion }); }} disabled={isPending} />
      </ScrollView>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, gap: 14 },
  skeletons: { gap: 12, marginTop: 8 },
});
