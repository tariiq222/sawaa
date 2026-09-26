import { StyleSheet } from 'react-native';

import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { sawaaRadius, sawaaSpacing, sawaaType, withAlpha } from '@/theme/sawaa';

export const createAppointmentsStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  scroll: { paddingHorizontal: sawaaSpacing.lg },
  header: { gap: sawaaSpacing.lg, marginBottom: sawaaSpacing.lg },
  title: {
    fontSize: sawaaType.heading.fontSize,
    lineHeight: sawaaType.heading.lineHeight,
    color: colors.ink[900],
    paddingHorizontal: sawaaSpacing.xs,
  },
  subtitle: {
    fontSize: sawaaType.caption.fontSize,
    lineHeight: sawaaType.caption.lineHeight,
    color: colors.ink[500],
    marginTop: 2,
    paddingHorizontal: sawaaSpacing.xs,
  },
  pageControls: { justifyContent: 'center', gap: sawaaSpacing.sm },
  pageButton: {
    paddingVertical: sawaaSpacing.sm,
    paddingHorizontal: sawaaSpacing.md,
    borderRadius: sawaaRadius.pill,
    backgroundColor: withAlpha(colors.teal[500], 0.12),
  },
  pageButtonText: { color: colors.ink[900], fontSize: sawaaType.caption.fontSize },
  skeletonWrap: { gap: sawaaSpacing.md, marginTop: sawaaSpacing.sm },
  card: { padding: 0, marginBottom: sawaaSpacing.lg },
  cardInner: { padding: sawaaSpacing.md, gap: sawaaSpacing.md },
  cardTop: { alignItems: 'center', gap: sawaaSpacing.md },
  avatar: {
    width: 44, height: 44, borderRadius: sawaaRadius.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: {
    fontSize: sawaaType.subheading.fontSize,
    lineHeight: sawaaType.subheading.lineHeight,
    color: colors.ink[900],
  },
  cardMid: { flex: 1 },
  therapist: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    color: colors.ink[900],
  },
  metaRow: { alignItems: 'center', gap: sawaaSpacing.xs, marginTop: 2 },
  metaText: {
    fontSize: sawaaType.micro.fontSize,
    lineHeight: sawaaType.micro.lineHeight,
    color: colors.ink[500],
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: withAlpha(colors.ink[900], 0.1) },
  cardBottom: { alignItems: 'center', justifyContent: 'space-between', gap: sawaaSpacing.sm },
  dateCol: { gap: 2 },
  dateLabel: {
    fontSize: sawaaType.micro.fontSize,
    lineHeight: sawaaType.micro.lineHeight,
    color: colors.ink[400],
  },
  dateValue: {
    fontSize: sawaaType.caption.fontSize,
    lineHeight: sawaaType.caption.lineHeight,
    color: colors.ink[900],
  },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: sawaaSpacing.xs,
    paddingHorizontal: sawaaSpacing.sm, paddingVertical: sawaaSpacing.xs, borderRadius: sawaaRadius.sm,
  },
  statusChipText: { fontSize: sawaaType.micro.fontSize, lineHeight: sawaaType.micro.lineHeight },
});
