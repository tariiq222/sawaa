import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { sawaaSpacing } from '@/theme/sawaa/tokens';
import { ActionButton } from '@/theme/sawaa/ActionButton';

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

/** Page navigation uses the backend's metadata; filters belong to the caller. */
export function PaginationControls({ page, totalPages, onPageChange, disabled = false }: PaginationControlsProps) {
  const { t } = useTranslation();
  const dir = useDir();
  if (totalPages <= 1 && page <= 1) return null;
  return (
    <View style={[styles.row, { flexDirection: dir.row }]}>
      {page > 1 ? <ActionButton variant="soft" height={44} label={t('common.back')} disabled={disabled} onPress={() => onPageChange(page - 1)} labelStyle={styles.label} fontFamily={getFontName(dir.locale, '600')} /> : null}
      {page < totalPages ? <ActionButton variant="soft" height={44} label={t('common.next')} disabled={disabled} onPress={() => onPageChange(page + 1)} labelStyle={styles.label} fontFamily={getFontName(dir.locale, '600')} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { justifyContent: 'center', gap: sawaaSpacing.md },
  label: { fontSize: 14, lineHeight: 20 },
});
