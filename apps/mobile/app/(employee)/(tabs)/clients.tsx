import { useState, useMemo, useRef } from 'react';
import { View, FlatList, Pressable, TextInput, StyleSheet, Text } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AquaBackground,
  GlassSurface,
  sawaaColors,
  sawaaRadius,
  sawaaSpacing,
  sawaaType,
  withAlpha,
} from '@/theme/sawaa';
import { Avatar } from '@/components/ui/Avatar';
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
  return (
    <GlassSurface variant="base" radius={sawaaRadius.lg} padding={sawaaSpacing.lg}>
      <View style={styles.skeletonRow}>
        <Skeleton width={44} height={44} radius={sawaaRadius.pill} />
        <View style={styles.skeletonLines}>
          <Skeleton width="60%" height={14} radius={sawaaRadius.xs} />
          <Skeleton width="35%" height={11} radius={sawaaRadius.xs} />
        </View>
      </View>
    </GlassSurface>
  );
}

export default function ClientsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const reduceMotion = useReduceMotion();
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading } = useEmployeeClients({ search: debouncedSearch });

  const clients = useMemo<ClientItem[]>(
    () =>
      (data ?? []).map((p) => ({
        id: p.id,
        name: `${p.firstName} ${p.lastName}`,
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

  const showSkeleton = isLoading && clients.length === 0;

  return (
    <AquaBackground>
      <View style={[styles.container, { paddingTop: insets.top + sawaaSpacing.lg }]}>
        <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(600).easing(Easing.out(Easing.cubic))}>
          <Text style={[styles.title, { fontFamily: f700, textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
            {t('employee.clients')}
          </Text>
        </Animated.View>

        <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(100).duration(600).easing(Easing.out(Easing.cubic))}>
          <GlassSurface variant="strong" radius={sawaaRadius.pill} style={styles.searchCard}>
            <View style={[styles.searchRow, { flexDirection: dir.row }]}>
              <Search size={18} strokeWidth={1.5} color={sawaaColors.ink[500]} />
              <TextInput
                value={search}
                onChangeText={handleSearch}
                placeholder={t('doctor.searchClients')}
                placeholderTextColor={sawaaColors.ink[400]}
                textAlign={dir.textAlign}
                accessibilityRole="search"
                style={[
                  styles.searchInput,
                  { fontFamily: f400, writingDirection: dir.writingDirection },
                ]}
              />
            </View>
          </GlassSurface>
        </Animated.View>

        {showSkeleton ? (
          <View style={styles.skeletonList}>
            {[0, 1, 2, 3].map((i) => (
              <ClientRowSkeleton key={i} />
            ))}
          </View>
        ) : (
          <FlatList
            data={clients}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ height: sawaaSpacing.sm }} />}
            renderItem={({ item, index }) => (
              <Animated.View
                entering={reduceMotion ? undefined : FadeInDown.delay(180 + index * 60).duration(600).easing(Easing.out(Easing.cubic))}
              >
                <Pressable style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                  <GlassSurface variant="base" radius={sawaaRadius.lg} padding={sawaaSpacing.lg}>
                    <View style={[styles.clientRow, { flexDirection: dir.row }]}>
                      <Avatar size={44} name={item.name} imageUrl={item.avatarUrl} color={sawaaColors.teal[600]} />
                      <View style={styles.clientMid}>
                        <Text
                          numberOfLines={1}
                          style={[styles.clientName, { fontFamily: f600, fontWeight: '600', textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}
                        >
                          {item.name}
                        </Text>
                        {item.lastVisit !== null && (
                          <Text style={[styles.clientMeta, { textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
                            {t('doctor.lastVisit')}:{' '}
                            {new Date(item.lastVisit).toLocaleDateString(
                              dir.isRTL ? 'ar-SA' : 'en-US',
                              { month: 'short', day: 'numeric' },
                            )}
                          </Text>
                        )}
                      </View>
                      {item.visitCount > 0 && (
                        <View style={[styles.visitBadge, { backgroundColor: withAlpha(sawaaColors.teal[600], 0.1) }]}>
                          <Text style={[styles.visitBadgeText, { fontFamily: f600, fontWeight: '600', writingDirection: dir.writingDirection }]}>
                            {item.visitCount} {t('doctor.visits')}
                          </Text>
                        </View>
                      )}
                    </View>
                  </GlassSurface>
                </Pressable>
              </Animated.View>
            )}
            ListEmptyComponent={
              <EmptyState
                icon="people-outline"
                title={debouncedSearch ? t('common.noResults') : t('doctor.noClients')}
              />
            }
          />
        )}
      </View>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: sawaaSpacing.lg },
  title: {
    fontSize: sawaaType.heading.fontSize,
    lineHeight: sawaaType.heading.lineHeight,
    color: sawaaColors.ink[900],
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
    color: sawaaColors.ink[900],
    padding: 0,
  },
  list: { paddingBottom: 100 },
  clientRow: { alignItems: 'center', gap: sawaaSpacing.md },
  clientMid: { flex: 1, gap: sawaaSpacing.xs },
  clientName: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    color: sawaaColors.ink[900],
  },
  clientMeta: {
    fontSize: sawaaType.caption.fontSize,
    lineHeight: sawaaType.caption.lineHeight,
    color: sawaaColors.ink[500],
  },
  visitBadge: {
    borderRadius: sawaaRadius.pill,
    paddingHorizontal: sawaaSpacing.sm,
    paddingVertical: sawaaSpacing.xs,
  },
  visitBadgeText: {
    fontSize: sawaaType.micro.fontSize,
    lineHeight: sawaaType.micro.lineHeight,
    color: sawaaColors.teal[700],
  },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: sawaaSpacing.md },
  skeletonLines: { flex: 1, gap: sawaaSpacing.sm },
  skeletonList: { gap: sawaaSpacing.sm },
});
