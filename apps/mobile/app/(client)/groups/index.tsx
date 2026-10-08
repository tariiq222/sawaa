import React, { useCallback, useMemo } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { sawaaType } from '@/theme/sawaa/tokens';
import { GroupCard } from '@/components/features/groups/GroupCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { useBranding, useGroupSessions } from '@/hooks/queries';
import { goBackOrHome } from '@/lib/navigation';
import { useDir } from '@/hooks/useDir';
import type { GroupSession } from '@/services/client/group-sessions';
import { getFontName } from '@/theme/fonts';
import { AquaBackground, sawaaRadius, sawaaSpacing } from '@/theme/sawaa';

export default function GroupsScreen() {
  const colors = useSawaaColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const { t } = useTranslation();
  const groupsQuery = useGroupSessions();
  const brandingQuery = useBranding();
  const contactPhone = brandingQuery.data?.contactPhone ?? null;
  const groups = useMemo(() => groupsQuery.data ?? [], [groupsQuery.data]);

  const renderItem = useCallback(({ item }: { item: GroupSession }) => (
    <GroupCard
      group={item}
      contactPhone={contactPhone}
      onOpen={() => router.push(`/(client)/groups/${item.id}`)}
    />
  ), [contactPhone, router]);

  const emptyState = useMemo(() => {
    if (groupsQuery.isLoading) {
      return (
        <View style={styles.skeletons}>
          {[0, 1, 2].map((i) => <Skeleton key={`group-skeleton-${i}`} height={150} radius={sawaaRadius.lg} />)}
        </View>
      );
    }
    if (groupsQuery.isError) {
      return (
        <EmptyState
          icon="cloud-offline-outline"
          tone="danger"
          title={t('groups.bookError')}
          actionLabel={t('common.retry')}
          onAction={() => { void groupsQuery.refetch(); }}
        />
      );
    }
    return <EmptyState icon="people-outline" title={t('groups.empty')} />;
  }, [groupsQuery, t]);

  return (
    <AquaBackground>
      <FlatList
        data={groups}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={(
          <View style={styles.header}>
            <ScreenHeader title={t('groups.title')} onBack={() => goBackOrHome(router, '/(client)/(tabs)/home')} />
            <Text style={[styles.intro, { color: colors.ink[700], fontFamily: getFontName(dir.locale, '400'), textAlign: dir.textAlign }]}>
              {t('groups.intro')}
            </Text>
          </View>
        )}
        ListEmptyComponent={emptyState}
      />
    </AquaBackground>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  list: { flexGrow: 1, paddingHorizontal: sawaaSpacing.lg },
  header: { gap: sawaaSpacing.md, marginBottom: sawaaSpacing.xl },
  intro: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight },
  separator: { height: sawaaSpacing.md },
  skeletons: { gap: sawaaSpacing.md },
});
