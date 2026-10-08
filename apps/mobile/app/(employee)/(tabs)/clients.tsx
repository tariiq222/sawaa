import { useState, useMemo, useRef } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { View, FlatList, Pressable, TextInput, StyleSheet, Text } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Glass } from '@/theme/components/Glass';
import {
  AquaBackground,
  sawaaRadius,
  sawaaSpacing,
  sawaaType,
} from '@/theme/sawaa';
import { Pill } from '@/components/ui/Pill';
import { Thumb } from '@/components/ui/Thumb';
import { AppButton } from '@/components/ui/AppButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDir } from '@/hooks/useDir';
import { useReduceMotion } from '@/hooks/useA11y';
import { getFontName } from '@/theme/fonts';
import { useEmployeeClients } from '@/hooks/queries/useEmployeeClients';

interface ClientItem {
  id: string;
  name: string;
  avatarUrl: string | null;
  lastVisit: string | null;
  visitCount: number;
}

function ClientRowSkeleton() {
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Glass variant="base" radius={sawaaRadius.lg} padding={sawaaSpacing.lg}>
      <View style={styles.skeletonRow}>
        <Skeleton width={52} height={52} radius={sawaaRadius.pill} />
        <View style={styles.skeletonLines}>
          <Skeleton width="60%" height={14} radius={sawaaRadius.xs} />
          <Skeleton width="35%" height={11} radius={sawaaRadius.xs} />
        </View>
      </View>
    </Glass>
  );
}

export default function ClientsScreen() {
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const reduceMotion = useReduceMotion();
  const f400 = getFontName(dir.locale, '400');
  const f700 = getFontName(dir.locale, '700');
  const router = useRouter();
  const Chevron = dir.isRTL ? ChevronLeft : ChevronRight;

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading, isFetching, isError, isPlaceholderData, refetch } = useEmployeeClients({ search: debouncedSearch });

  const clients = useMemo<ClientItem[]>(
    () =>
      (data ?? []).map((p) => ({
        id: p.id,
        name: p.name || [p.firstName, p.lastName].filter(Boolean).join(' '),
        avatarUrl: p.avatarUrl,
        lastVisit: null,
        visitCount: 0,
      })),
    [data],
  );

  const handleSearch = (text: string) => {
    setSearch(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(text), 400);
  };

  const hasCurrentData = data !== undefined && !isPlaceholderData;
  const displayedClients = hasCurrentData ? clients : [];
  const retry = () => { void refetch(); };
  const firstReadError = isError && !hasCurrentData;
  const retainedReadError = isError && hasCurrentData;
  const showSkeleton = !hasCurrentData && (isLoading || isFetching || isPlaceholderData);

  return (
    <AquaBackground>
      <View style={[styles.container, { paddingTop: insets.top + sawaaSpacing.lg }]}>
        <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(600).easing(Easing.out(Easing.cubic))}>
          <Text accessibilityRole="header" style={[styles.title, { fontFamily: f700, textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
            {t('employee.clients')}
          </Text>
        </Animated.View>

        <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(100).duration(600).easing(Easing.out(Easing.cubic))}>
          <Glass variant="base" radius={sawaaRadius.pill} style={styles.searchCard}>
            <View style={[styles.searchRow, { flexDirection: dir.row }]}>
              <Search size={18} strokeWidth={1.5} color={colors.ink[500]} />
              <TextInput
                value={search}
                onChangeText={handleSearch}
                placeholder={t('doctor.searchClients')}
                placeholderTextColor={colors.ink[400]}
                textAlign={dir.textAlign}
                accessibilityRole="search"
                style={[
                  styles.searchInput,
                  { fontFamily: f400, writingDirection: dir.writingDirection },
                ]}
              />
            </View>
          </Glass>
        </Animated.View>

        {retainedReadError && (
          <View accessibilityRole="alert" style={styles.retryNotice}>
            <Text style={[styles.clientMeta, { fontFamily: f400, textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>{t('doctor.clientsLoadFailed')}</Text>
            <AppButton variant="ghost" size="sm" label={t('common.retry')} onPress={retry} />
          </View>
        )}
        {showSkeleton ? (
          <View style={styles.skeletonList}>
            {[0, 1, 2, 3].map((i) => (
              <ClientRowSkeleton key={i} />
            ))}
          </View>
        ) : (
          <FlatList
            data={displayedClients}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ height: sawaaSpacing.sm }} />}
            renderItem={({ item, index }) => (
              <Animated.View
                entering={reduceMotion ? undefined : FadeInDown.delay(180 + Math.min(index, 6) * 60).duration(600).easing(Easing.out(Easing.cubic))}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={item.name}
                  onPress={() => router.push({
                    pathname: '/(employee)/client/[id]',
                    params: {
                      id: item.id,
                    },
                  })}
                  style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                >
                  <Glass variant="base" radius={sawaaRadius.lg} padding={sawaaSpacing.lg}>
                    <View style={[styles.clientRow, { flexDirection: dir.row }]}>
                      <Thumb uri={item.avatarUrl} width={52} height={52} radius={sawaaRadius.pill} />
                      <View style={styles.clientMid}>
                        <Text
                          style={[styles.clientName, { fontFamily: f700, textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}
                        >
                          {item.name}
                        </Text>
                        {item.lastVisit !== null && (
                          <Text style={[styles.clientMeta, { fontFamily: f400, textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
                            {t('doctor.lastVisit')}:{' '}
                            {new Date(item.lastVisit).toLocaleDateString(
                              dir.isRTL ? 'ar-SA' : 'en-US',
                              { month: 'short', day: 'numeric' },
                            )}
                          </Text>
                        )}
                      </View>
                      {item.visitCount > 0 && <Pill label={`${item.visitCount} ${t('doctor.visits')}`} />}
                      <Chevron size={20} color={colors.ink[500]} strokeWidth={1.75} />
                    </View>
                  </Glass>
                </Pressable>
              </Animated.View>
            )}
            ListEmptyComponent={
              firstReadError ? (
                <EmptyState icon="cloud-offline-outline" tone="danger"
                  title={t('doctor.clientsLoadFailed')} description={t('doctor.clientsLoadFailedHint')}
                  actionLabel={t('common.retry')} onAction={retry} />
              ) : hasCurrentData ? (
                <EmptyState icon="people-outline"
                  title={debouncedSearch ? t('common.noResults') : t('doctor.noClients')} />
              ) : null
            }
          />
        )}
      </View>
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  container: { flex: 1, paddingHorizontal: sawaaSpacing.lg },
  title: {
    fontSize: sawaaType.heading.fontSize, lineHeight: sawaaType.heading.lineHeight,
    color: colors.ink[900],
    marginBottom: sawaaSpacing.lg,
  },
  searchCard: { marginBottom: sawaaSpacing.lg },
  searchRow: {
    alignItems: 'center',
    gap: sawaaSpacing.sm,
    paddingHorizontal: sawaaSpacing.lg,
    paddingVertical: sawaaSpacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: sawaaType.body.fontSize,
    color: colors.ink[900],
    padding: 0,
  },
  list: { paddingBottom: 100 },
  clientRow: { alignItems: 'center', gap: sawaaSpacing.md },
  clientMid: { flex: 1, minWidth: 0, flexShrink: 1, gap: sawaaSpacing.xs },
  clientName: {
    fontSize: sawaaType.subheading.fontSize, lineHeight: sawaaType.subheading.lineHeight,
    color: colors.ink[900],
  },
  clientMeta: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    color: colors.ink[700],
  },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: sawaaSpacing.md },
  skeletonLines: { flex: 1, gap: sawaaSpacing.sm },
  retryNotice: { gap: sawaaSpacing.xs, marginBottom: sawaaSpacing.sm },
  skeletonList: { gap: sawaaSpacing.sm },
});
