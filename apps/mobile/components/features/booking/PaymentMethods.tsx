import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { Apple, Banknote, Building2, Check, CreditCard } from 'lucide-react-native';

import { Glass } from '@/theme/components/Glass';
import { getSawaaRoles, sawaaRadius, sawaaSpacing, sawaaType, withAlpha } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useTheme } from '@/theme/useTheme';
import { getFontName } from '@/theme/fonts';
import type { DirState } from '@/hooks/useDir';
import { useReduceMotion } from '@/hooks/useA11y';
import type { BookingPaymentMethod } from '@/features/booking/use-booking-payment';

const META: Record<BookingPaymentMethod, {
  icon: React.ReactNode;
  labelAr: string;
  labelEn: string;
  subAr: string;
  subEn: string;
}> = {
  card: {
    icon: <CreditCard size={20} color="currentColor" strokeWidth={1.75} />,
    labelAr: 'بطاقة ائتمانية',
    labelEn: 'Credit card',
    subAr: 'Visa · Mada · Mastercard',
    subEn: 'Visa · Mada · Mastercard',
  },
  apple_pay: {
    icon: <Apple size={20} color="currentColor" strokeWidth={1.75} />,
    labelAr: 'Apple Pay',
    labelEn: 'Apple Pay',
    subAr: 'ادفع بلمسة واحدة',
    subEn: 'Pay with one touch',
  },
  bank_transfer: {
    icon: <Banknote size={20} color="currentColor" strokeWidth={1.75} />,
    labelAr: 'تحويل بنكي',
    labelEn: 'Bank transfer',
    subAr: 'حوّل يدوياً وارفع الإيصال',
    subEn: 'Transfer and upload receipt',
  },
  at_center: {
    icon: <Building2 size={20} color="currentColor" strokeWidth={1.75} />,
    labelAr: 'الدفع في المركز',
    labelEn: 'Pay at the center',
    subAr: 'أكّد موعدك الآن وادفع عند الحضور',
    subEn: 'Confirm now and pay when you arrive',
  },
};

interface PaymentMethodsProps {
  methods: BookingPaymentMethod[];
  selected: BookingPaymentMethod;
  onSelect: (method: BookingPaymentMethod) => void;
  dir: DirState;
}

/** Payment-method chooser for the new booking review step. */
export function PaymentMethods({ methods, selected, onSelect, dir }: PaymentMethodsProps) {
  const colors = useSawaaColors();
  const { scheme } = useTheme();
  const roles = getSawaaRoles(scheme);
  const reduceMotion = useReduceMotion();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const f400 = getFontName(dir.locale, '400');
  const f700 = getFontName(dir.locale, '700');

  return (
    <>
      {methods.map((key, i) => {
        const meta = META[key];
        const isSelected = selected === key;
        return (
          <Animated.View
            key={key}
            entering={reduceMotion ? undefined : FadeInDown.delay(160 + i * 80).duration(700).easing(Easing.out(Easing.cubic))}
          >
            <Glass
              radius={sawaaRadius.lg}
              onPress={() => onSelect(key)}
              interactive
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              style={[styles.methodCard, { borderWidth: 2, borderColor: isSelected ? roles.selection.fill : 'transparent' }]}
            >
              <View style={[styles.methodRow, { flexDirection: dir.row }]}>
                <View style={[styles.methodIcon, { backgroundColor: withAlpha(colors.teal[600], 0.12) }]}>
                  {React.cloneElement(meta.icon as React.ReactElement<{ color?: string }>, { color: colors.teal[600] })}
                </View>
                <View style={styles.methodMid}>
                  <Text style={[styles.methodLabel, { fontFamily: f700, textAlign: dir.textAlign }]}>
                    {dir.isRTL ? meta.labelAr : meta.labelEn}
                  </Text>
                  <Text style={[styles.methodSub, { fontFamily: f400, textAlign: dir.textAlign }]}>
                    {dir.isRTL ? meta.subAr : meta.subEn}
                  </Text>
                </View>
                <View
                  style={[styles.radio, {
                    borderColor: isSelected ? roles.selection.fill : colors.ink[400],
                    backgroundColor: isSelected ? roles.selection.fill : 'transparent',
                  }]}
                >
                  {isSelected ? <Check size={14} color={roles.selection.foreground} strokeWidth={3} /> : null}
                </View>
              </View>
            </Glass>
          </Animated.View>
        );
      })}
    </>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
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
    fontSize: sawaaType.caption.fontSize,
    lineHeight: sawaaType.caption.lineHeight,
    color: colors.ink[500],
    marginTop: sawaaSpacing.xs,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: sawaaRadius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
