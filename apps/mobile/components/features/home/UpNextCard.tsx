import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight, Video } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { sawaaRadius, getSawaaRoles } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useTheme } from '@/theme/ThemeProvider';
import type { DirState } from '@/hooks/useDir';
import type { PortalBookingRow } from '@/services/client/portal';

function formatRelativeTime(when: Date, now: Date, isRTL: boolean): string {
  const diffMs = when.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60000);
  const diffH = Math.round(diffMin / 60);
  const h = when.getHours();
  const m = String(when.getMinutes()).padStart(2, '0');
  const suffix = h < 12 ? (isRTL ? 'ص' : 'AM') : isRTL ? 'م' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const time = `${h12}:${m} ${suffix}`;
  if (diffMin < 0) return time;
  if (diffMin < 60) return isRTL ? `بعد ${diffMin} دقيقة · ${time}` : `In ${diffMin}m · ${time}`;
  if (diffH < 24) return isRTL ? `بعد ${diffH} ساعة · ${time}` : `In ${diffH}h · ${time}`;
  const days = Math.round(diffH / 24);
  return isRTL ? `بعد ${days} يوم · ${time}` : `In ${days}d · ${time}`;
}

interface UpNextCardProps {
  loading: boolean;
  booking: PortalBookingRow | null;
  dir: DirState;
  f600: string;
  f700: string;
}

export function UpNextCard({ loading, booking, dir, f600, f700 }: UpNextCardProps) {
  const sawaaColors = useSawaaColors();
  const { scheme } = useTheme();
  const action = getSawaaRoles(scheme).action;
  const styles = React.useMemo(() => createStyles(sawaaColors, action), [sawaaColors, action]);
  const router = useRouter();
  const ArrowIcon = dir.isRTL ? ChevronLeft : ChevronRight;

  if (loading) {
    return (
      <View style={[styles.sessionCard, styles.sessionLoading]}>
        <ActivityIndicator color={sawaaColors.teal[600]} />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[styles.sessionCard, styles.emptySession]}>
        <Text style={[styles.emptyText, { fontFamily: f600, fontWeight: '600', textAlign: dir.textAlign }]}>
          {dir.isRTL ? 'لا توجد جلسات قادمة' : 'No upcoming sessions'}
        </Text>
        <Pressable onPress={() => router.push('/(client)/therapists')} hitSlop={8}>
          <Text style={[styles.emptyCta, { fontFamily: f700 }]}>
            {dir.isRTL ? 'احجزي الآن' : 'Book now'}
          </Text>
        </Pressable>
      </View>
    );
  }

  const iso = booking.scheduledAt ?? `${booking.date}T${booking.startTime}:00Z`;
  const when = new Date(iso);
  const employeeName = booking.employee
    ? `${booking.employee.user.firstName} ${booking.employee.user.lastName}`.trim()
    : null;

  return (
    <View style={styles.sessionCard}>
      <Pressable
        onPress={() => router.push(`/(client)/appointment/${booking.id}`)}
        style={[styles.sessionRow, { flexDirection: dir.row }]}
      >
        <LinearGradient
          colors={action.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.sessionIcon}
        >
          <Video size={22} color={action.foreground} strokeWidth={1.75} />
        </LinearGradient>
        <View style={styles.sessionMid}>
          <Text style={[styles.sessionTime, { fontFamily: f600, fontWeight: '600', textAlign: dir.textAlign }]}>
            {formatRelativeTime(when, new Date(), dir.isRTL)}
          </Text>
          <Text style={[styles.sessionTitle, { fontFamily: f700, textAlign: dir.textAlign }]}>
            {employeeName
              ? dir.isRTL
                ? `جلسة مع ${employeeName}`
                : `Session with ${employeeName}`
              : dir.isRTL
                ? 'جلسة قادمة'
                : 'Upcoming session'}
          </Text>
        </View>
        <View style={styles.sessionGo}>
          <ArrowIcon size={14} color={action.foreground} strokeWidth={2} />
        </View>
      </Pressable>
    </View>
  );
}

const createStyles = (sawaaColors: ReturnType<typeof useSawaaColors>, action: ReturnType<typeof getSawaaRoles>['action']) => StyleSheet.create({
  sessionCard: { padding: 14, backgroundColor: sawaaColors.glass.opaqueBg, borderRadius: sawaaRadius.xl },
  sessionLoading: { alignItems: 'center', justifyContent: 'center', minHeight: 76 },
  emptySession: { padding: 18, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 13, color: sawaaColors.ink[700] },
  emptyCta: { fontSize: 13, color: sawaaColors.teal[700] },
  sessionRow: { alignItems: 'center', gap: 12 },
  sessionIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sessionMid: { flex: 1 },
  sessionTime: { fontSize: 11, color: sawaaColors.teal[700] },
  sessionTitle: { fontSize: 14.5, color: sawaaColors.ink[900], marginTop: 1 },
  sessionGo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: action.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
