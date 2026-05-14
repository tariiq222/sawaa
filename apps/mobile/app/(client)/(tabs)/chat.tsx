import { useCallback, useMemo, useRef } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { RotateCcw, Send } from 'lucide-react-native';
import type { IMessage } from 'react-native-gifted-chat';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';

import { AquaBackground, sawaaColors, sawaaRadius } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { useChat } from '@/hooks/queries/useChat';

export default function ChatTabScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const f400 = getFontName(dir.locale, '400');
  const f500 = getFontName(dir.locale, '500');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');

  const { messages, isTyping, error, sendMessage, reset, quickReplies } =
    useChat(dir.isRTL ? 'ar' : 'en');

  const [text, setText] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  // useChat returns messages newest-first; reverse for top-down display.
  const ordered = useMemo(() => [...messages].reverse(), [messages]);

  const send = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const msg: IMessage = {
      _id: `user-${Date.now()}`,
      text: trimmed,
      createdAt: new Date(),
      user: { _id: 'user' },
    };
    sendMessage(msg);
    setText('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [text, sendMessage]);

  const sendQuick = useCallback(
    (label: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const msg: IMessage = {
        _id: `user-${Date.now()}`,
        text: label,
        createdAt: new Date(),
        user: { _id: 'user' },
      };
      sendMessage(msg);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    },
    [sendMessage],
  );

  return (
    <AquaBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
        keyboardVerticalOffset={0}
      >
        {/* Swipe Hint */}
        <View style={[styles.hintWrap, { paddingTop: insets.top + 6 }]}>
          <Text style={[styles.hintText, { fontFamily: f400 }]}>
            {t('chatbot.swipeHint')}
          </Text>
        </View>

        {/* Header */}
        <View style={[styles.header, { paddingTop: 4, flexDirection: dir.row }]}>
          <View style={styles.headerSide} />
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
              {dir.isRTL ? 'دائمًا متاح · سرّي تمامًا' : 'Always here · Private'}
            </Text>
          </View>
          <View style={styles.headerSide}>
            <Glass variant="strong" radius={22} interactive onPress={reset} style={styles.iconBtn}>
              <RotateCcw size={18} color={sawaaColors.ink[700]} strokeWidth={1.75} />
            </Glass>
          </View>
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={[styles.errorText, { fontFamily: f500 }]}>{error}</Text>
          </View>
        ) : null}

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.messages, { paddingBottom: 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {ordered.map((m, i) => {
            const me = m.user._id === 'user';
            return (
              <Animated.View
                key={String(m._id)}
                entering={FadeInDown.delay(Math.min(i, 4) * 60).duration(360).easing(Easing.out(Easing.cubic))}
                style={[styles.bubbleRow, me ? styles.rowMe : styles.rowThem]}
              >
                {me ? (
                  <LinearGradient
                    colors={[sawaaColors.teal[500], sawaaColors.teal[700]]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.bubble, styles.bubbleMe]}
                  >
                    <Text
                      style={[
                        styles.bubbleMeText,
                        { fontFamily: f500, textAlign: dir.textAlign, writingDirection: dir.writingDirection },
                      ]}
                    >
                      {m.text}
                    </Text>
                  </LinearGradient>
                ) : (
                  <Glass variant="strong" radius={sawaaRadius.xl} style={[styles.bubble, styles.bubbleThem]}>
                    <Text
                      style={[
                        styles.bubbleThemText,
                        { fontFamily: f500, textAlign: dir.textAlign, writingDirection: dir.writingDirection },
                      ]}
                    >
                      {m.text}
                    </Text>
                  </Glass>
                )}
              </Animated.View>
            );
          })}

          {isTyping ? (
            <View style={[styles.bubbleRow, styles.rowThem]}>
              <Glass variant="strong" radius={sawaaRadius.xl} style={[styles.bubble, styles.typing]}>
                <Text style={[styles.bubbleThemText, { fontFamily: f500 }]}>…</Text>
              </Glass>
            </View>
          ) : null}

          {!isTyping && quickReplies.length > 0 ? (
            <View style={[styles.quickWrap, { flexDirection: dir.row }]}>
              {quickReplies.slice(0, 3).map((q) => {
                const label = dir.isRTL ? q.label_ar : q.label_en;
                return (
                  <Pressable key={q.action} onPress={() => sendQuick(label)}>
                    <Glass variant="strong" radius={sawaaRadius.pill} style={styles.quickPill}>
                      <Text style={[styles.quickText, { fontFamily: f600 }]}>{label}</Text>
                    </Glass>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </ScrollView>

        {/* Input bar */}
        <View style={[styles.inputWrap, { paddingBottom: insets.bottom + 12 }]}>
          <Glass variant="strong" radius={sawaaRadius.pill} style={styles.inputPill}>
            <View style={[styles.inputRow, { flexDirection: dir.row }]}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={t('chatbot.placeholder', dir.isRTL ? 'اكتبي رسالتكِ…' : 'Type a message…')}
                placeholderTextColor={sawaaColors.ink[400]}
                style={[
                  styles.input,
                  {
                    fontFamily: f400,
                    textAlign: dir.textAlign,
                    writingDirection: dir.writingDirection,
                    color: sawaaColors.ink[900],
                  },
                ]}
                onSubmitEditing={send}
                returnKeyType="send"
              />
              <Pressable
                onPress={send}
                disabled={!text.trim()}
                style={[styles.sendBtnPress, !text.trim() && { opacity: 0.55 }]}
              >
                <LinearGradient
                  colors={[sawaaColors.teal[500], sawaaColors.teal[700]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Send size={20} color="#fff" strokeWidth={2.4} />
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
  hintWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 2,
  },
  hintText: {
    fontSize: 10,
    color: sawaaColors.ink[400],
    opacity: 0.8,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    alignItems: 'center',
    gap: 10,
  },
  headerSide: { width: 40, alignItems: 'center' },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerMid: { flex: 1, alignItems: 'center' },
  headerTitleRow: { alignItems: 'center', gap: 6 },
  headerLogo: { width: 18, height: 18, borderRadius: 4 },
  headerTitle: { fontSize: 15, color: sawaaColors.ink[900] },
  headerSub: { fontSize: 11, color: sawaaColors.ink[500], marginTop: 2 },
  errorBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(239,122,107,0.12)',
  },
  errorText: { fontSize: 12.5, color: '#b14a3d' },
  messages: { paddingHorizontal: 16, gap: 8 },
  bubbleRow: { maxWidth: '85%' },
  rowMe: { alignSelf: 'flex-end' },
  rowThem: { alignSelf: 'flex-start' },
  bubble: { paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMe: {
    borderBottomRightRadius: 6,
    borderTopLeftRadius: sawaaRadius.xl,
    borderTopRightRadius: sawaaRadius.xl,
    borderBottomLeftRadius: sawaaRadius.xl,
    shadowColor: sawaaColors.teal[600],
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  bubbleThem: {},
  typing: { paddingHorizontal: 18 },
  bubbleMeText: { color: '#fff', fontSize: 13.5, lineHeight: 22 },
  bubbleThemText: { color: sawaaColors.ink[900], fontSize: 13.5, lineHeight: 22 },
  quickWrap: { flexWrap: 'wrap', gap: 8, marginTop: 10 },
  quickPill: { paddingHorizontal: 14, paddingVertical: 8 },
  quickText: { fontSize: 12.5, color: sawaaColors.teal[700] },
  inputWrap: { paddingHorizontal: 16, paddingTop: 8 },
  inputPill: { padding: 6, minHeight: 56 },
  inputRow: { alignItems: 'center', gap: 6, minHeight: 44 },
  input: { flex: 1, height: 44, paddingHorizontal: 18, fontSize: 14 },
  sendBtnPress: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: sawaaColors.teal[600],
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
});
