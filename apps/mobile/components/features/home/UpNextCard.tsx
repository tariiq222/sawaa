import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Glass } from '@/theme/components/Glass';
import { sawaaRadius, sawaaSpacing, sawaaType, getSawaaRoles, withAlpha } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useTheme } from '@/theme/ThemeProvider';
import type { DirState } from '@/hooks/useDir';
import type { PortalBookingRow } from '@/services/client/portal';

interface UpNextCardProps {
  loading: boolean;
  booking: PortalBookingRow | null;
  dir: DirState;
  f600: string;
  f700: string;
}

/** Compact "next appointment" hero: date box, time, therapist and delivery type. */
export function UpNextCard({ loading, booking, dir, f600, f700 }: UpNextCardProps) {
  const colors = useSawaaColors();
  const { scheme } = useTheme();
  const roles = getSawaaRoles(scheme);
  const action = roles.action;
  const styles = React.useMemo(() => createStyles(colors, action), [colors, action]);
  const router = useRouter();
  const { t } = useTranslation();
  const ArrowIcon = dir.isRTL ? ChevronLeft : ChevronRight;
  const locale = dir.isRTL ? 'ar-SA' : 'en-US';

  if (loading) {
    return (
      <Glass variant="strong" radius={sawaaRadius.xl} style={[styles.card, styles.loading]}>
        <ActivityIndicator color={colors.teal[600]} />
      </Glass>
    );
  }

  if (!booking) {
    return (
      <Glass variant="strong" radius={sawaaRadius.xl} style={[styles.card, styles.empty]}>
        <Text style={[styles.emptyText, { fontFamily: f600, textAlign: dir.textAlign }]}>{t('home.noUpcoming')}</Text>
        <Pressable onPress={() => router.push('/(client)/therapists')} accessibilityRole="button" style={styles.emptyCta}>
          <Text style={[styles.emptyCtaText, { fontFamily: f700 }]}>{t('home.bookNow')}</Text>
        </Pressable>
      </Glass>
    );
  }

  const iso = booking.scheduledAt ?? `${booking.date}T${booking.startTime}:00Z`;
  const when = new Date(iso);
  const day = when.toLocaleDateString(locale, { day: 'numeric' });
  const weekday = when.toLocaleDateString(locale, { weekday: 'short' });
  const time = when.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  const employeeName = booking.employee
    ? `${booking.employee.user.firstName} ${booking.employee.user.lastName}`.trim()
    : '';
  const delivery = booking.type === 'online' ? t('home.online') : booking.type === 'in_person' ? t('home.inPerson') : '';
  const detail = [employeeName ? t('home.withTherapist', { name: employeeName }) : '', delivery].filter(Boolean).join(' · ');

  return (
    <Pressable
      onPress={() => router.push(`/(client)/appointment/${booking.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${t('home.upcomingAppointment')}: ${weekday} ${day}, ${time}. ${detail}`}
      accessibilityHint={t('home.openAppointment')}
    >
      <LinearGradient
        colors={action.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, styles.hero]}
      >
        <Text style={[styles.label, { fontFamily: f600, textAlign: dir.textAlign }]}>{t('home.upcomingAppointment')}</Text>
        <View style={[styles.row, { flexDirection: dir.row }]}>
          <View style={styles.dateBox}>
            <Text style={[styles.dateDay, { fontFamily: f700 }]}>{day}</Text>
            <Text style={[styles.dateWeekday, { fontFamily: f600 }]}>{weekday}</Text>
          </View>
          <View style={styles.mid}>
            <Text style={[styles.time, { fontFamily: f700, textAlign: dir.textAlign }]}>{time}</Text>
            {detail ? (
              <Text numberOfLines={2} style={[styles.detail, { fontFamily: f600, textAlign: dir.textAlign }]}>{detail}</Text>
            ) : null}
          </View>
          <View style={styles.go}>
            <ArrowIcon size={20} color={colors.teal[700]} strokeWidth={2} />
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>, action: ReturnType<typeof getSawaaRoles>['action']) => StyleSheet.create({
  card: { padding: 16, borderRadius: sawaaRadius.xl, gap: 10 },
  hero: { overflow: 'hidden' },
  loading: { alignItems: 'center', justifyContent: 'center', minHeight: 96 },
  empty: { alignItems: 'center' },
  emptyText: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight, color: colors.ink[700] },
  emptyCta: { minHeight: 44, justifyContent: 'center' },
  emptyCtaText: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight, color: colors.teal[700] },
  label: { fontSize: sawaaType.bodySm.fontSize, lineHeight: sawaaType.bodySm.lineHeight, color: withAlpha(action.foreground, 0.85) },
  row: { alignItems: 'center', gap: 12 },
  dateBox: {
    width: 56,
    minHeight: 56,
    paddingVertical: sawaaSpacing.sm,
    borderRadius: sawaaRadius.md,
    backgroundColor: colors.teal[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: { fontSize: sawaaType.heading.fontSize, lineHeight: sawaaType.heading.lineHeight, color: colors.teal[700] },
  dateWeekday: { fontSize: sawaaType.caption.fontSize, lineHeight: sawaaType.caption.lineHeight, color: colors.teal[700] },
  mid: { flex: 1, gap: 2 },
  time: { fontSize: sawaaType.subheading.fontSize, lineHeight: sawaaType.subheading.lineHeight, color: action.foreground },
  detail: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight, color: withAlpha(action.foreground, 0.9) },
  go: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.teal[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
