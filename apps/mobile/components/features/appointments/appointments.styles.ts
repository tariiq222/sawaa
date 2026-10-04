import { StyleSheet } from 'react-native';

import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { sawaaRadius, sawaaSpacing, withAlpha } from '@/theme/sawaa';

export const createAppointmentsStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  scroll: { paddingHorizontal: sawaaSpacing.lg },
  header: { gap: sawaaSpacing.lg, marginBottom: sawaaSpacing.xl },
  // Tab-root title: 28 / 38 bold.
  title: { fontSize: 28, lineHeight: 38, color: colors.ink[900] },
  tabs: { gap: sawaaSpacing.sm, flexWrap: 'wrap' },
  cardWrap: { marginBottom: sawaaSpacing.md },
  pageControls: { justifyContent: 'center', gap: sawaaSpacing.sm },
  pageButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: sawaaSpacing.lg,
    borderRadius: sawaaRadius.pill,
    backgroundColor: withAlpha(colors.teal[500], 0.12),
  },
  pageButtonText: { color: colors.ink[900], fontSize: 14 },
  skeletonWrap: { gap: sawaaSpacing.md },
});
