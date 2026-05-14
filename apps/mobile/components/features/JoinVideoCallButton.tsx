import React, { useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Video } from 'lucide-react-native';

import { sawaaColors, sawaaRadius } from '@/theme/sawaa';
import { getFontName } from '@/theme/fonts';
import { FEATURE_FLAGS } from '@/constants/feature-flags';

interface Props {
  /** Client uses join URL; employee uses start URL (host link). */
  url: string | null;
  scheduledAt: string;
  durationMins: number;
  status: 'PENDING' | 'CREATED' | 'FAILED' | 'CANCELLED' | null;
  isRTL: boolean;
  /** "join" for client, "start" for employee (host) */
  variant: 'join' | 'start';
}

const JOIN_WINDOW_MS_BEFORE = 15 * 60 * 1000;

export function JoinVideoCallButton({
  url,
  scheduledAt,
  durationMins,
  status,
  isRTL,
  variant,
}: Props) {
  // Hooks must run unconditionally — feature-flag gating happens after.
  const f600 = getFontName(isRTL ? 'ar' : 'en', '600');
  const f700 = getFontName(isRTL ? 'ar' : 'en', '700');

  const { withinWindow, label } = useMemo(() => {
    if (status === 'FAILED') {
      return { withinWindow: false, label: isRTL ? 'تعذّر إنشاء الاجتماع' : 'Meeting unavailable' };
    }
    if (status !== 'CREATED' || !url) {
      return { withinWindow: false, label: isRTL ? 'سيظهر الرابط قبل الموعد' : 'Link appears before session' };
    }
    const start = new Date(scheduledAt).getTime();
    const end = start + durationMins * 60 * 1000;
    const now = Date.now();
    const opensAt = start - JOIN_WINDOW_MS_BEFORE;
    if (now < opensAt) {
      const minsUntilOpen = Math.max(1, Math.round((opensAt - now) / 60000));
      return {
        withinWindow: false,
        label: isRTL ? `يفتح خلال ${minsUntilOpen} دقيقة` : `Opens in ${minsUntilOpen} min`,
      };
    }
    if (now > end) {
      return { withinWindow: false, label: isRTL ? 'انتهت الجلسة' : 'Session ended' };
    }
    return {
      withinWindow: true,
      label: variant === 'start'
        ? (isRTL ? 'بدء الاجتماع' : 'Start meeting')
        : (isRTL ? 'انضمام للجلسة' : 'Join session'),
    };
  }, [status, url, scheduledAt, durationMins, isRTL, variant]);

  if (!FEATURE_FLAGS.videoCalls) return null;

  const onPress = () => {
    if (!withinWindow || !url) return;
    Linking.openURL(url).catch(() => undefined);
  };

  return (
    <Pressable onPress={onPress} disabled={!withinWindow} style={styles.btn}>
      <LinearGradient
        colors={withinWindow
          ? [sawaaColors.teal[500], sawaaColors.teal[700]]
          : ['#cbd5da', '#a3b0b8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradient, { borderRadius: sawaaRadius.pill }]}
      >
        <Video size={18} color="#fff" strokeWidth={1.75} />
        <Text style={[styles.text, { fontFamily: withinWindow ? f700 : f600 }]}>
          {label}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { flex: 1.4 },
  gradient: {
    height: 52,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  text: { color: '#fff', fontSize: 13.5 },
});
