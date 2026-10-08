import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PublicBranchSummary } from '@/services/client';
import { AppButton } from '@/components/ui/AppButton';
import { Check } from 'lucide-react-native';
import { Glass } from '@/theme/components/Glass';
import { sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import type { DirState } from '@/hooks/useDir';

interface Props {
  branches: PublicBranchSummary[];
  branchId?: string;
  loading: boolean;
  error: boolean;
  onSelect: (id: string) => void;
  onRetry: () => void;
  dir: DirState;
  f400: string;
  f600: string;
  f700: string;
}

export function PackageBranchPicker({ branches, branchId, loading, error, onSelect, onRetry, dir, f400, f600, f700 }: Props) {
  const sawaaColors = useSawaaColors();
  const styles = React.useMemo(() => createStyles(sawaaColors), [sawaaColors]);
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { fontFamily: f700, textAlign: dir.textAlign }]}>{t('packages.chooseBranch')}</Text>
      {loading ? <Text style={[styles.message, { fontFamily: f400 }]}>{t('packages.branchLoading')}</Text> : null}
      {error ? (
        <View style={styles.errorRow}>
          <Text style={[styles.message, { fontFamily: f400 }]}>{t('packages.branchError')}</Text>
          <AppButton label={t('packages.retry')} variant="secondary" size="sm" onPress={onRetry} />
        </View>
      ) : null}
      {!loading && !error && branches.length === 0 ? <Text style={[styles.message, { fontFamily: f400 }]}>{t('packages.branchUnavailable')}</Text> : null}
      <View style={styles.list}>
        {branches.map((branch) => {
          const selected = branch.id === branchId;
          return (
            <Pressable key={branch.id} onPress={() => onSelect(branch.id)} accessibilityRole="radio" accessibilityLabel={dir.isRTL ? branch.nameAr : branch.nameEn ?? branch.nameAr} accessibilityState={{ selected }}><Glass radius={sawaaRadius.sm} variant={selected ? 'strong' : 'regular'} style={[styles.branch, selected && styles.selected]}>
              <Text style={[styles.branchName, { fontFamily: f600, textAlign: dir.textAlign }]}>{dir.isRTL ? branch.nameAr : branch.nameEn ?? branch.nameAr}</Text>
              {branch.city ? <Text style={[styles.city, { fontFamily: f400, textAlign: dir.textAlign }]}>{branch.city}</Text> : null}
              {selected ? <Check size={18} color={sawaaColors.teal[700]} /> : null}
            </Glass></Pressable>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (sawaaColors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  container: { gap: sawaaSpacing.sm },
  title: { color: sawaaColors.ink[900], fontSize: sawaaType.subheading.fontSize },
  message: { color: sawaaColors.ink[500], fontSize: sawaaType.caption.fontSize },
  errorRow: { alignItems: 'center', gap: sawaaSpacing.sm },
  retry: { color: sawaaColors.teal[700], fontSize: sawaaType.caption.fontSize },
  list: { gap: sawaaSpacing.sm },
  branch: { minHeight: 44, padding: sawaaSpacing.md },
  selected: { borderWidth: 1, borderColor: sawaaColors.teal[500] },
  branchName: { color: sawaaColors.ink[900], fontSize: sawaaType.body.fontSize },
  city: { color: sawaaColors.ink[500], fontSize: sawaaType.caption.fontSize, marginTop: sawaaSpacing.xs },
});
