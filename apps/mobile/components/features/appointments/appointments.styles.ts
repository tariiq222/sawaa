import { StyleSheet } from 'react-native';

import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { sawaaRadius, sawaaSpacing, sawaaType, withAlpha } from '@/theme/sawaa';

export const createAppointmentsStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  scroll: { paddingHorizontal: sawaaSpacing.lg },
  header: { gap: sawaaSpacing.lg, marginBottom: sawaaSpacing.xl },
  title: { fontSize: sawaaType.heading.fontSize, lineHeight: sawaaType.heading.lineHeight, color: colors.ink[900] },
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
  pageButtonText: { color: colors.ink[900], fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight },
  skeletonWrap: { gap: sawaaSpacing.md },
});
