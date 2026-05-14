import { useState, useMemo, useRef } from 'react';
import {
  View,
  FlatList,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Search, Users as UsersIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/theme/components/ThemedText';
import { ThemedCard } from '@/theme/components/ThemedCard';
import { Avatar } from '@/components/ui/Avatar';
import { useTheme } from '@/theme/useTheme';
import { useEmployeeClients } from '@/hooks/queries/useEmployeeClients';

interface ClientItem {
  id: string;
  name: string;
  avatarUrl: string | null;
  lastVisit: string | null;
  visitCount: number;
}

export default function ClientsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { theme, isRTL } = useTheme();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fontFamily = isRTL ? 'IBM Plex Sans Arabic' : 'Inter';

  const { data, isLoading, isFetching } = useEmployeeClients({ search: debouncedSearch });

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

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.surface, paddingTop: insets.top + 16 },
      ]}
    >
      <ThemedText variant="displaySm" style={styles.title}>
        {t('employee.clients')}
      </ThemedText>

      <View style={[styles.searchBar, theme.shadows.md, { backgroundColor: theme.colors.white }]}>
        <Search size={18} strokeWidth={1.5} color={theme.colors.textSecondary} />
        <TextInput
          value={search}
          onChangeText={handleSearch}
          placeholder={t('doctor.searchClients')}
          placeholderTextColor={theme.colors.textMuted}
          textAlign={isRTL ? 'right' : 'left'}
          style={[styles.searchInput, { color: theme.colors.textPrimary, fontFamily }]}
        />
        {isFetching && !isLoading ? (
          <ActivityIndicator size="small" color={theme.colors.textSecondary} />
        ) : null}
      </View>

      {isLoading && clients.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" />
      ) : null}

      <FlatList
        data={clients}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => (
          <Pressable style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
            <ThemedCard style={styles.clientCard}>
              <View style={styles.clientRow}>
                <Avatar size={44} name={item.name} imageUrl={item.avatarUrl} />
                <View style={{ flex: 1, gap: 2 }}>
                  <ThemedText variant="subheading" numberOfLines={1}>
                    {item.name}
                  </ThemedText>
                  {item.lastVisit !== null && (
                    <ThemedText variant="caption" color={theme.colors.textSecondary}>
                      {t('doctor.lastVisit')}:{' '}
                      {new Date(item.lastVisit).toLocaleDateString(
                        isRTL ? 'ar-SA' : 'en-US',
                        { month: 'short', day: 'numeric' },
                      )}
                    </ThemedText>
                  )}
                </View>
                {item.visitCount > 0 && (
                  <View style={[styles.visitBadge, { backgroundColor: theme.colors.primary + '1A' }]}>
                    <ThemedText variant="caption" color={theme.colors.primary} style={{ fontWeight: '600' }}>
                      {item.visitCount} {t('doctor.visits')}
                    </ThemedText>
                  </View>
                )}
              </View>
            </ThemedCard>
          </Pressable>
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <UsersIcon size={48} strokeWidth={1} color={theme.colors.textMuted} />
              <ThemedText variant="body" color={theme.colors.textMuted} align="center">
                {t('doctor.noClients')}
              </ThemedText>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  title: { marginBottom: 16 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  list: { paddingBottom: 100 },
  clientCard: { padding: 14 },
  clientRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  visitBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  empty: { alignItems: 'center', gap: 16, paddingTop: 80 },
});
