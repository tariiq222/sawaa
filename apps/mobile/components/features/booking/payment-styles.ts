import { StyleSheet } from 'react-native';
import { sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa/tokens';
import type { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import type { useTheme } from '@/theme/useTheme';

export const createPaymentStyles = (colors: ReturnType<typeof useSawaaColors>, themeColors: ReturnType<typeof useTheme>['theme']['colors']) => StyleSheet.create({
  scroll: { paddingHorizontal: sawaaSpacing.lg, gap: sawaaSpacing.md },
  title: {
    fontSize: sawaaType.heading.fontSize,
    lineHeight: sawaaType.heading.lineHeight,
    color: colors.ink[900],
    marginTop: 0,
    paddingHorizontal: sawaaSpacing.xs,
  },
  subtitle: {
    fontSize: sawaaType.caption.fontSize,
    lineHeight: sawaaType.caption.lineHeight,
    color: colors.ink[500],
    marginTop: 0,
    paddingHorizontal: sawaaSpacing.xs,
  },
  methodCard: { padding: sawaaSpacing.md },
  methodRow: { alignItems: 'center', gap: sawaaSpacing.md },
  methodIcon: {
    width: 44,
    height: 44,
    borderRadius: sawaaRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodMid: { flex: 1 },
  methodLabel: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    color: colors.ink[900],
  },
  methodSub: {
    fontSize: sawaaType.micro.fontSize,
    lineHeight: sawaaType.micro.lineHeight,
    color: colors.ink[500],
    marginTop: sawaaSpacing.xs,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: sawaaRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaWrap: { position: 'absolute', left: sawaaSpacing.lg, right: sawaaSpacing.lg },
  ctaBtnText: {
    color: themeColors.primaryForeground,
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
  },
});
