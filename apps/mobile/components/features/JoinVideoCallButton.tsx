import React, { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Video } from 'lucide-react-native';

import { getSawaaRoles, sawaaRadius } from '@/theme/sawaa';
import { useTheme } from '@/theme/useTheme';
import { getFontName } from '@/theme/fonts';
import { useTranslation } from 'react-i18next';
import { videoJoinWindow } from '@/lib/video-join-window';
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
  /** Stretch to the container width (stacked layouts) instead of flexing inside a row. */
  fullWidth?: boolean;
}

export function JoinVideoCallButton({
  url,
  scheduledAt,
  durationMins,
  status,
  isRTL,
  variant,
  fullWidth = false,
}: Props) {
  const { theme, scheme } = useTheme();
  const action = getSawaaRoles(scheme).action;
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!FEATURE_FLAGS.videoCalls || status !== 'CREATED' || !url) return;
    const current = Date.now();
    const window = videoJoinWindow(scheduledAt, durationMins, current);
    if (!window || current > window.endsAt) return;
    const next = current < window.opensAt ? Math.min(current + 60_000, window.opensAt) : window.endsAt + 1;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(1, next - current));
    return () => clearTimeout(timer);
  }, [now, scheduledAt, durationMins, status, url]);
  // Hooks must run unconditionally — feature-flag gating happens after.
  const f600 = getFontName(isRTL ? 'ar' : 'en', '600');
  const f700 = getFontName(isRTL ? 'ar' : 'en', '700');

  const { withinWindow, label } = (() => {
    if (status === 'FAILED') {
      return { withinWindow: false, label: t('videoCall.meetingUnavailable') };
    }
    if (status !== 'CREATED' || !url) {
      return { withinWindow: false, label: t('videoCall.meetingNotReady') };
    }
    const current = Date.now();
    const window = videoJoinWindow(scheduledAt, durationMins, current);
    if (!window) return { withinWindow: false, label: t('videoCall.meetingUnavailable') };
    if (current < window.opensAt) {
      return { withinWindow: false, label: t('videoCall.opensIn', { minutes: window.minutesUntilOpen }) };
    }
    if (current > window.endsAt) {
      return { withinWindow: false, label: t('videoCall.sessionEnded') };
    }
    return {
      withinWindow: true,
      label: variant === 'start'
        ? t('doctor.startMeeting')
        : t('videoCall.joinSession'),
    };
  })();

  if (!FEATURE_FLAGS.videoCalls) return null;

  const onPress = () => {
    if (!withinWindow || !url || !videoJoinWindow(scheduledAt, durationMins, Date.now())?.withinWindow) return;
    Linking.openURL(url).catch(() => undefined);
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={!withinWindow}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !withinWindow }}
      style={fullWidth ? styles.btnFull : styles.btn}
    >
      <LinearGradient
        colors={withinWindow
          ? action.gradient
          : [theme.colors.surfaceHigh, theme.colors.surfaceLow]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradient, { borderRadius: sawaaRadius.pill }]}
      >
        <Video size={18} color={withinWindow ? action.foreground : theme.colors.textMuted} strokeWidth={1.75} />
        <Text style={[styles.text, { color: withinWindow ? action.foreground : theme.colors.textMuted, fontFamily: withinWindow ? f700 : f600, fontWeight: withinWindow ? undefined : '600' }]}>
          {label}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { flex: 1.4 },
  btnFull: { alignSelf: 'stretch' },
  gradient: {
    height: 56,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  text: { fontSize: 15 },
});
