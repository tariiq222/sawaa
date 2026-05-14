import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react-native';

import { AquaBackground, sawaaColors, sawaaRadius } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { useRateBooking } from '@/hooks/queries';

const QUICK_TAGS = [
  { ar: 'مهنية', en: 'Professional' },
  { ar: 'استماع جيد', en: 'Great listener' },
  { ar: 'مفيدة', en: 'Helpful' },
  { ar: 'هادئة', en: 'Calm' },
  { ar: 'متفهّمة', en: 'Understanding' },
];

export default function RateScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
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

  const toggleTag = (i: number) => {
    Haptics.selectionAsync();
    const next = new Set(tags);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setTags(next);
  };

  const submit = () => {
    if (rating === 0 || !bookingId || submitting) return;
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
          Alert.alert(
            dir.isRTL ? 'تعذّر إرسال التقييم' : 'Could not submit rating',
            error instanceof Error ? error.message : String(error),
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
          <Glass variant="strong" radius={22} onPress={() => router.back()} interactive style={styles.backBtn}>
            <BackIcon size={22} color={sawaaColors.ink[700]} strokeWidth={1.75} />
          </Glass>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(600).easing(Easing.out(Easing.cubic))}>
          <Text style={[styles.title, { fontFamily: f700, textAlign: dir.textAlign }]}>
            {dir.isRTL ? 'كيف كانت الجلسة؟' : 'How was your session?'}
          </Text>
          <Text style={[styles.subtitle, { fontFamily: f400, textAlign: dir.textAlign }]}>
            {dir.isRTL ? 'تقييمك يساعد المعالج والآخرين' : 'Your rating helps your therapist and others'}
          </Text>
        </Animated.View>

        {/* Therapist */}
        <Animated.View entering={FadeInDown.delay(160).duration(700).easing(Easing.out(Easing.cubic))}>
          <Glass variant="strong" radius={sawaaRadius.xl} style={styles.therapistCard}>
            <View style={[styles.therapistRow, { flexDirection: dir.row }]}>
              <LinearGradient
                colors={['#f7cbb7', '#e88f6c']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatar}
              >
                <Text style={[styles.avatarText, { fontFamily: f700 }]}>ف</Text>
              </LinearGradient>
              <View style={styles.therapistMid}>
                <Text style={[styles.therapistName, { fontFamily: f700, textAlign: dir.textAlign }]}>
                  {dir.isRTL ? 'د. فاطمة العمران' : 'Dr. Fatima Al-Omran'}
                </Text>
                <Text style={[styles.therapistMeta, { fontFamily: f400, textAlign: dir.textAlign }]}>
                  {dir.isRTL ? 'جلسة اليوم · ٤:٠٠ م' : "Today's session · 4:00 PM"}
                </Text>
              </View>
            </View>
          </Glass>
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
              >
                <Star
                  size={40}
                  color={filled ? sawaaColors.accent.amber : sawaaColors.ink[400]}
                  fill={filled ? sawaaColors.accent.amber : 'transparent'}
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
            {QUICK_TAGS.map((t, i) => {
              const isActive = tags.has(i);
              return (
                <Pressable key={`tag-${i}`} onPress={() => toggleTag(i)}>
                  <Glass
                    variant={isActive ? 'strong' : 'regular'}
                    radius={14}
                    style={[
                      styles.tag,
                      isActive && { borderWidth: 1.5, borderColor: sawaaColors.teal[500] },
                    ]}
                  >
                    <Text style={[
                      styles.tagText,
                      { fontFamily: f600, color: isActive ? sawaaColors.teal[700] : sawaaColors.ink[700] },
                    ]}>
                      {dir.isRTL ? t.ar : t.en}
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
              placeholderTextColor={sawaaColors.ink[400]}
              multiline
              numberOfLines={4}
              style={[
                styles.noteInput,
                { fontFamily: f400, textAlign: dir.textAlign, writingDirection: dir.writingDirection, color: sawaaColors.ink[900] },
              ]}
            />
          </Glass>
        </Animated.View>
      </ScrollView>

      <Animated.View
        entering={FadeInDown.delay(500).duration(800).easing(Easing.out(Easing.cubic))}
        style={[styles.ctaWrap, { bottom: insets.bottom + 20 }]}
      >
        <Pressable disabled={rating === 0 || submitting} onPress={submit}>
          <LinearGradient
            colors={[sawaaColors.teal[500], sawaaColors.teal[700]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.ctaBtn, (rating === 0 || submitting) && { opacity: 0.55 }]}
          >
            <Text style={[styles.ctaBtnText, { fontFamily: f700 }]}>
              {submitting
                ? (dir.isRTL ? 'جاري الإرسال…' : 'Submitting…')
                : (dir.isRTL ? 'إرسال التقييم' : 'Submit rating')}
            </Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, gap: 14 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  title: { fontSize: 24, color: sawaaColors.ink[900], marginTop: 8, paddingHorizontal: 4 },
  subtitle: { fontSize: 12.5, color: sawaaColors.ink[500], marginTop: 4, paddingHorizontal: 4 },
  therapistCard: { padding: 14 },
  therapistRow: { alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, color: '#fff' },
  therapistMid: { flex: 1 },
  therapistName: { fontSize: 14, color: sawaaColors.ink[900] },
  therapistMeta: { fontSize: 11.5, color: sawaaColors.ink[500], marginTop: 2 },
  starsWrap: { flexDirection: 'row', justifyContent: 'center', gap: 10, paddingVertical: 14 },
  starBtn: { padding: 4 },
  sectionTitle: { fontSize: 14, color: sawaaColors.ink[900], marginBottom: 8, paddingHorizontal: 4 },
  tagRow: { flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 12, paddingVertical: 8 },
  tagText: { fontSize: 12 },
  noteCard: { padding: 14 },
  noteInput: { fontSize: 13, minHeight: 80 },
  ctaWrap: { position: 'absolute', left: 16, right: 16 },
  ctaBtn: {
    borderRadius: 999, height: 52,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: sawaaColors.teal[600], shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
  },
  ctaBtnText: { color: '#fff', fontSize: 14 },
});
