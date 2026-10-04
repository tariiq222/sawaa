import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ClinicCard, filterClinics } from '@/components/features/directory/ClinicCard';
import { DirectorySearch } from '@/components/features/directory/DirectorySearch';
import { useClinics } from '@/hooks/queries';
import { useDir } from '@/hooks/useDir';
import type { ClinicEntry } from '@/lib/clinics';
import { getFontName } from '@/theme/fonts';
import { AquaBackground } from '@/theme/sawaa';
import { sawaaSpacing, sawaaType } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

export default function ClinicsScreen() {
  const colors = useSawaaColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const { t } = useTranslation();
  const clinicsQuery = useClinics();
  const [query, setQuery] = useState('');
  const clinics = useMemo(() => clinicsQuery.data ?? [], [clinicsQuery.data]);
  const visible = useMemo(() => filterClinics(clinics, query), [clinics, query]);
  const messageStyle = [styles.message, { color: colors.ink[500], fontFamily: getFontName(dir.locale, '400') }];

  const renderItem = useCallback(({ item }: { item: ClinicEntry }) => (
    <ClinicCard
      clinic={item}
      onPress={() => router.push({ pathname: '/(client)/clinic/[id]', params: { id: item.id } })}
    />
  ), [router]);

  const emptyState = (() => {
    if (clinicsQuery.isLoading) return <Text style={messageStyle}>{t('common.loading')}</Text>;
    if (clinicsQuery.isError) {
      return (
        <View style={styles.empty}>
          <Text style={messageStyle}>{t('clinics.loadError')}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.retry')}
            onPress={() => { void clinicsQuery.refetch(); }}
            style={styles.retry}
          >
            <Text style={[styles.retryText, { color: colors.teal[700], fontFamily: getFontName(dir.locale, '600') }]}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      );
    }
    return <Text style={messageStyle}>{clinics.length > 0 ? t('common.noResults') : t('clinics.empty')}</Text>;
  })();

  return (
    <AquaBackground>
      <FlatList
        data={visible}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={(
          <View style={styles.header}>
            <ScreenHeader title={t('clinics.title')} onBack={() => router.back()} />
            <DirectorySearch
              value={query}
              onChangeText={setQuery}
              placeholder={t('clinics.searchPlaceholder')}
              accessibilityLabel={t('clinics.searchPlaceholder')}
              testID="clinic-search"
            />
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
  separator: { height: sawaaSpacing.md },
  empty: { alignItems: 'center', gap: sawaaSpacing.sm },
  message: { fontSize: sawaaType.body.fontSize + 1, lineHeight: 22, textAlign: 'center', paddingVertical: sawaaSpacing['3xl'] },
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: sawaaSpacing.lg },
  retryText: { fontSize: 14, textDecorationLine: 'underline' },
});
