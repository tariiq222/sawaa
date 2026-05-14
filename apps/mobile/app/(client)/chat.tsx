import React, { useRef, useState, useCallback, useMemo } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight, Send } from 'lucide-react-native';

import { AquaBackground, sawaaColors, sawaaRadius } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { useReduceMotion } from '@/hooks/useA11y';

type Msg = { id: string; me: boolean; text: { ar: string; en: string } };
const INITIAL_MSGS: Msg[] = [
  { id: '1', me: false, text: { ar: 'مرحباً سارة ✨ كيف يمكنني مساعدتكِ اليوم؟', en: 'Hi Sara ✨ How can I help you today?' } },
  { id: '2', me: true, text: { ar: 'أشعر بقلق قبل النوم، هل هناك تمرين يساعدني؟', en: "I feel anxious before sleep — any exercise that helps?" } },
  { id: '3', me: false, text: { ar: 'بالتأكيد. جرّبي تمرين التنفّس ٤-٧-٨: شهيق ٤ ثوانٍ، حبس ٧، زفير ٨. كرّري ٤ مرات.', en: 'Try 4-7-8 breathing: inhale 4s, hold 7s, exhale 8s. Repeat 4x.' } },
];

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const { t } = useTranslation();
  const reduceMotion = useReduceMotion();
  const f400 = getFontName(dir.locale, '400');
  const f500 = getFontName(dir.locale, '500');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const BackIcon = dir.isRTL ? ChevronRight : ChevronLeft;
  const [msgs, setMsgs] = useState<Msg[]>(INITIAL_MSGS);
  const [text, setText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const send = () => {
    if (!text.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next: Msg = { id: String(Date.now()), me: true, text: { ar: text, en: text } };
    setMsgs((m) => [...m, next]);
    setText('');
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const renderItem = useCallback(({ item: m, index: i }: { item: Msg; index: number }) => (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.delay(i < INITIAL_MSGS.length ? i * 80 : 0).duration(400).easing(Easing.out(Easing.cubic))}
      style={[styles.bubbleRow, m.me ? styles.rowMe : styles.rowThem]}
    >
      {m.me ? (
        <LinearGradient
          colors={[sawaaColors.teal[500], sawaaColors.teal[700]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.bubble, styles.bubbleMe]}
        >
          <Text style={[styles.bubbleMeText, { fontFamily: f500, textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
            {dir.isRTL ? m.text.ar : m.text.en}
          </Text>
        </LinearGradient>
      ) : (
        <Glass variant="strong" radius={sawaaRadius.xl} style={[styles.bubble, styles.bubbleThem]}>
          <Text style={[styles.bubbleThemText, { fontFamily: f500, textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
            {dir.isRTL ? m.text.ar : m.text.en}
          </Text>
        </Glass>
      )}
    </Animated.View>
  ), [dir, f500, reduceMotion]);

  const ListHeader = useMemo(() => (
    <View style={[styles.header, { paddingTop: insets.top + 10, flexDirection: dir.row }]}>
      <Glass variant="strong" radius={22} onPress={() => router.back()} interactive style={styles.backBtn} accessibilityLabel={t('a11y.buttonBack')}>
        <BackIcon size={22} color={sawaaColors.ink[700]} strokeWidth={1.75} />
      </Glass>
      <View style={styles.headerMid}>
        <View style={[styles.headerTitleRow, { flexDirection: dir.row }]}>
          <Image
            source={require('@/assets/sawa/icon.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <Text style={[styles.headerTitle, { fontFamily: f700 }]}>
            {dir.isRTL ? 'سَواء' : 'Sawaa'}
          </Text>
        </View>
        <Text style={[styles.headerSub, { fontFamily: f400 }]}>
          {dir.isRTL ? 'يعتمد على الذكاء الاصطناعي' : 'AI-powered'}
        </Text>
      </View>
      <View style={styles.headerPlaceholder} />
    </View>
  ), [BackIcon, dir, f400, f700, insets.top, router, t]);

  return (
    <AquaBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={msgs}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={[styles.messages, { paddingBottom: 20 }]}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
        />

        {/* Input bar */}
        <View style={[styles.inputWrap, { paddingBottom: insets.bottom + 12 }]}>
          <Glass variant="strong" radius={sawaaRadius.pill} style={styles.inputPill}>
            <View style={[styles.inputRow, { flexDirection: dir.row }]}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={dir.isRTL ? 'اكتبي رسالتكِ…' : 'Type a message…'}
                placeholderTextColor={sawaaColors.ink[400]}
                accessibilityLabel={t('a11y.messageInput')}
                testID="chat-input"
                style={[
                  styles.input,
                  { fontFamily: f400, textAlign: dir.textAlign, writingDirection: dir.writingDirection, color: sawaaColors.ink[900] },
                ]}
                onSubmitEditing={send}
                returnKeyType="send"
              />
              <Pressable
                onPress={send}
                disabled={!text.trim()}
                style={styles.sendBtnPress}
                accessibilityRole="button"
                accessibilityLabel={t('a11y.sendMessage')}
                testID="send-btn"
              >
                <LinearGradient
                  colors={[sawaaColors.teal[500], sawaaColors.teal[700]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.sendBtn, !text.trim() && { opacity: 0.55 }]}
                >
                  <Send size={16} color="#fff" strokeWidth={2} style={{ transform: [{ scaleX: dir.isRTL ? -1 : 1 }] }} />
                </LinearGradient>
              </Pressable>
            </View>
          </Glass>
        </View>
      </KeyboardAvoidingView>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingHorizontal: 16, paddingBottom: 12,
    alignItems: 'center', gap: 10,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerMid: { flex: 1, alignItems: 'center' },
  headerTitleRow: { alignItems: 'center', gap: 6 },
  headerLogo: { width: 18, height: 18, borderRadius: 4 },
  headerTitle: { fontSize: 15, color: sawaaColors.ink[900] },
  headerSub: { fontSize: 11, color: sawaaColors.ink[500], marginTop: 2 },
  headerPlaceholder: { width: 40 },
  messages: { paddingHorizontal: 16, gap: 8 },
  bubbleRow: { maxWidth: '85%', marginBottom: 8 },
  rowMe: { alignSelf: 'flex-end' },
  rowThem: { alignSelf: 'flex-start' },
  bubble: { paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMe: {
    borderBottomRightRadius: 6,
    borderTopLeftRadius: sawaaRadius.xl,
    borderTopRightRadius: sawaaRadius.xl,
    borderBottomLeftRadius: sawaaRadius.xl,
    shadowColor: sawaaColors.teal[600], shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  bubbleThem: { },
  bubbleMeText: { color: '#fff', fontSize: 13.5, lineHeight: 22 },
  bubbleThemText: { color: sawaaColors.ink[900], fontSize: 13.5, lineHeight: 22 },
  inputWrap: { paddingHorizontal: 16, paddingTop: 8 },
  inputPill: { padding: 6 },
  inputRow: { alignItems: 'center', gap: 6 },
  input: { flex: 1, height: 40, paddingHorizontal: 16, fontSize: 13.5 },
  sendBtnPress: { height: 40 },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: sawaaColors.teal[600], shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
});
