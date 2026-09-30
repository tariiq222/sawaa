import { StyleSheet } from 'react-native';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa';

export const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: sawaaSpacing.xl, gap: sawaaSpacing.lg },
  loaderTitle: { marginBottom: sawaaSpacing.sm },
  loaderAction: { marginTop: sawaaSpacing.sm },
  headerRow: { justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: sawaaType.heading.fontSize, lineHeight: sawaaType.heading.lineHeight, color: colors.ink[900] },
  infoCard: { marginBottom: sawaaSpacing.sm },
  infoList: { gap: sawaaSpacing.md },
  infoRow: { alignItems: 'center', gap: sawaaSpacing.md },
  iconCircle: { width: 36, height: 36, borderRadius: sawaaRadius.pill, alignItems: 'center', justifyContent: 'center' },
  infoText: { flex: 1, fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight, color: colors.ink[900] },
  barAction: { flex: 1 },
  cancelInner: { height: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: sawaaSpacing.md },
  cancelText: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight, color: colors.accent.coral, textAlign: 'center' },
});
