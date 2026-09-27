import React, { useMemo, useState } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useTheme } from '@/theme/useTheme';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AquaBackground, sawaaRadius } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { useBooking, useRateBooking } from '@/hooks/queries';

const QUICK_TAGS = [
  { ar: 'مهنية', en: 'Professional' },
  { ar: 'استماع جيد', en: 'Great listener' },
  { ar: 'مفيدة', en: 'Helpful' },
  { ar: 'هادئة', en: 'Calm' },
  { ar: 'متفهّمة', en: 'Understanding' },
];

export default function RateScreen() {
  const colors = useSawaaColors();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(colors, theme), [colors, theme]);
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const BackIcon = dir.isRTL ? ChevronRight : ChevronLeft;
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<Set<number>>(new Set());
  const [note, setNote] = useState('');
  const rateMutation = useRateBooking();
  const submitting = rateMutation.isPending;
  const { data: booking, isLoading, isError, refetch } = useBooking(bookingId);

  // The therapist identity comes from the rated booking — never a placeholder.
  const therapistName = booking
    ? (dir.isRTL
        ? booking.employee?.nameAr ?? booking.employee?.nameEn ?? booking.employeeNameAr ?? booking.employeeName
        : booking.employee?.nameEn ?? booking.employee?.nameAr ?? booking.employeeName ?? booking.employeeNameAr)
    : undefined;
  const displayName = therapistName ?? t('therapists.unknownName');
  const sessionWhen = booking?.scheduledAt
    ? new Date(booking.scheduledAt).toLocaleString(dir.isRTL ? 'ar-SA' : 'en-US', {
        weekday: 'long', hour: 'numeric', minute: '2-digit',
      })
    : null;

  // Rating is only allowed against a booking we actually loaded: while the
  // request is in flight, or after it failed, there is no verified subject to
  // rate — the user gets the retry action instead of a blind submission.
  const bookingReady = Boolean(booking) && !isLoading && !isError;
  const alreadyRatedThisSession = booking?.ratingSubmittedLocally === true;
  const submitDisabled = rating === 0 || submitting || !bookingReady || alreadyRatedThisSession;

  const toggleTag = (i: number) => {
    Haptics.selectionAsync();
    const next = new Set(tags);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setTags(next);
  };

  const submit = () => {
    if (rating === 0 || !bookingId || submitting || !bookingReady) return;
    const tagLabels = [...tags]
      .map((i) => (dir.isRTL ? QUICK_TAGS[i].ar : QUICK_TAGS[i].en))
      .join(', ');
    const comment = [tagLabels, note.trim()].filter(Boolean).join(' — ');
    rateMutation.mutate(
      {
        id: bookingId,
        score: rating,
        comment: comment || undefined,
        isPublic: true,
      },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        },
        onError: (error) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          const responseMessage = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
          const duplicateRating = typeof responseMessage === 'string'
            && responseMessage.toLowerCase().includes('rating already submitted');
          Alert.alert(
            duplicateRating ? t('appointments.ratingAlreadySubmitted') : (dir.isRTL ? 'تعذّر إرسال التقييم' : 'Could not submit rating'),
            duplicateRating
              ? t('appointments.ratingAlreadySubmitted')
              : error instanceof Error ? error.message : String(error),
          );
        },
      },
    );
  };

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(500)}>
          <Glass variant="strong" radius={22} onPress={() => router.back()} interactive accessibilityLabel={t('a11y.buttonBack')} style={[styles.backBtn, { alignSelf: dir.alignStart }]}>
            <BackIcon size={22} color={colors.ink[700]} strokeWidth={1.75} />
          </Glass>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(600).easing(Easing.out(Easing.cubic))}>
          <Text style={[styles.title, { fontFamily: f700, textAlign: dir.textAlign }]}>
            {dir.isRTL ? 'كيف كانت الجلسة؟' : 'How was your session?'}
          </Text>
          <Text style={[styles.subtitle, { fontFamily: f400, fontWeight: '400', textAlign: dir.textAlign }]}>
            {dir.isRTL ? 'تقييمك يساعد المعالج والآخرين' : 'Your rating helps your therapist and others'}
          </Text>
        </Animated.View>

        {/* Therapist — real booking data, or a retryable load error */}
        <Animated.View entering={FadeInDown.delay(160).duration(700).easing(Easing.out(Easing.cubic))}>
          {isLoading ? (
            <Skeleton height={76} radius={sawaaRadius.xl} />
          ) : isError ? (
            <EmptyState
              icon="alert-circle-outline"
              title={t('common.error')}
              actionLabel={t('common.retry')}
              onAction={() => { void refetch(); }}
              tone="danger"
            />
          ) : (
            <Glass variant="strong" radius={sawaaRadius.xl} style={styles.therapistCard}>
              <View style={[styles.therapistRow, { flexDirection: dir.row }]}>
                <LinearGradient
                  colors={theme.colors.primaryGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatar}
                >
                  <Text style={[styles.avatarText, { fontFamily: f700 }]}>
                    {displayName.trim().charAt(0)}
                  </Text>
                </LinearGradient>
                <View style={styles.therapistMid}>
                  <Text style={[styles.therapistName, { fontFamily: f700, textAlign: dir.textAlign }]}>
                    {displayName}
                  </Text>
                  {sessionWhen ? (
                    <Text style={[styles.therapistMeta, { fontFamily: f400, fontWeight: '400', textAlign: dir.textAlign }]}>
                      {sessionWhen}
                    </Text>
                  ) : null}
                </View>
              </View>
            </Glass>
          )}
        </Animated.View>

        {/* Stars */}
        <Animated.View entering={FadeInDown.delay(240).duration(700).easing(Easing.out(Easing.cubic))} style={styles.starsWrap}>
          {[1, 2, 3, 4, 5].map((n) => {
            const filled = n <= rating;
            return (
              <Pressable
                key={n}
                onPress={() => {
                  Haptics.selectionAsync();
                  setRating(n);
                }}
                style={styles.starBtn}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('a11y.rateStars', { count: n })}
              >
                <Star
                  size={40}
                  color={filled ? colors.accent.amber : colors.ink[400]}
                  fill={filled ? colors.accent.amber : 'transparent'}
                  strokeWidth={1.75}
                />
              </Pressable>
            );
          })}
        </Animated.View>

        {/* Tags */}
        <Animated.View entering={FadeInDown.delay(320).duration(700).easing(Easing.out(Easing.cubic))}>
          <Text style={[styles.sectionTitle, { fontFamily: f700, textAlign: dir.textAlign }]}>
            {dir.isRTL ? 'ما الذي أعجبكِ؟' : 'What did you like?'}
          </Text>
          <View style={[styles.tagRow, { flexDirection: dir.row }]}>
            {QUICK_TAGS.map((tag, i) => {
              const isActive = tags.has(i);
              return (
                <Pressable key={`tag-${i}`} onPress={() => toggleTag(i)}>
                  <Glass
                    variant={isActive ? 'strong' : 'regular'}
                    radius={14}
                    style={[
                      styles.tag,
                      isActive && { borderWidth: 1.5, borderColor: colors.teal[500] },
                    ]}
                  >
                    <Text style={[
                      styles.tagText,
                      { fontFamily: f600, fontWeight: '600', color: isActive ? colors.teal[700] : colors.ink[700] },
                    ]}>
                      {dir.isRTL ? tag.ar : tag.en}
                    </Text>
                  </Glass>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {/* Comment */}
        <Animated.View entering={FadeInDown.delay(400).duration(700).easing(Easing.out(Easing.cubic))}>
          <Text style={[styles.sectionTitle, { fontFamily: f700, textAlign: dir.textAlign }]}>
            {dir.isRTL ? 'ملاحظة (اختياري)' : 'Comment (optional)'}
          </Text>
          <Glass variant="regular" radius={sawaaRadius.xl} style={styles.noteCard}>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={dir.isRTL ? 'شاركي تجربتكِ باختصار…' : 'Share briefly…'}
              placeholderTextColor={colors.ink[400]}
              multiline
              numberOfLines={4}
              style={[
                styles.noteInput,
                { fontFamily: f400, fontWeight: '400', textAlign: dir.textAlign, writingDirection: dir.writingDirection, color: colors.ink[900] },
              ]}
            />
          </Glass>
        </Animated.View>
      </ScrollView>

      <Animated.View
        entering={FadeInDown.delay(500).duration(800).easing(Easing.out(Easing.cubic))}
        style={[styles.ctaWrap, { bottom: insets.bottom + 20 }]}
      >
        <Pressable
          disabled={submitDisabled}
          onPress={submit}
          accessibilityRole="button"
          accessibilityState={{ disabled: submitDisabled, busy: submitting }}
        >
          <LinearGradient
            colors={theme.colors.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.ctaBtn, submitDisabled && { opacity: 0.55 }]}
          >
            <Text style={[styles.ctaBtnText, { fontFamily: f700 }]}>
              {alreadyRatedThisSession
                ? t('appointments.ratingAlreadySubmitted')
                : submitting
                ? (dir.isRTL ? 'جاري الإرسال…' : 'Submitting…')
                : (dir.isRTL ? 'إرسال التقييم' : 'Submit rating')}
            </Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>, theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  scroll: { paddingHorizontal: 16, gap: 14 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  title: { fontSize: 24, color: colors.ink[900], marginTop: 8, paddingHorizontal: 4 },
  subtitle: { fontSize: 12.5, color: colors.ink[500], marginTop: 4, paddingHorizontal: 4 },
  therapistCard: { padding: 14 },
  therapistRow: { alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, color: theme.colors.primaryForeground },
  therapistMid: { flex: 1 },
  therapistName: { fontSize: 14, color: colors.ink[900] },
  therapistMeta: { fontSize: 11.5, color: colors.ink[500], marginTop: 2 },
  starsWrap: { flexDirection: 'row', justifyContent: 'center', gap: 10, paddingVertical: 14 },
  starBtn: { padding: 4 },
  sectionTitle: { fontSize: 14, color: colors.ink[900], marginBottom: 8, paddingHorizontal: 4 },
  tagRow: { flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 12, paddingVertical: 8 },
  tagText: { fontSize: 12 },
  noteCard: { padding: 14 },
  noteInput: { fontSize: 13, minHeight: 80 },
  ctaWrap: { position: 'absolute', left: 16, right: 16 },
  ctaBtn: {
    borderRadius: 999, height: 52,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.teal[600], shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
  },
  ctaBtnText: { color: theme.colors.primaryForeground, fontSize: 14 },
});
