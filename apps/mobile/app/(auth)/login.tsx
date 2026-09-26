import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
  StyleSheet,
  TextInput,
  Image,
} from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { Glass } from '@/theme';
import { sawaaTokens } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { AquaBackground, PrimaryButton } from '@/theme/sawaa';
import { useDir } from '@/hooks/useDir';
import { useRequestLoginOtp } from '@/hooks/queries';
import { getFontName } from '@/theme/fonts';
import { goBackOrHome } from '@/lib/navigation';

export default function LoginScreen() {
  const { booking, redirect } = useLocalSearchParams<{ booking?: string; redirect?: string }>();
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');

  const [identifier, setIdentifier] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const requestOtp = useRequestLoginOtp();

  const handleLogin = useCallback(async () => {
    if (!identifier.trim()) {
      setError(t('auth.login.identifierError'));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    try {
      const result = await requestOtp.mutateAsync({ identifier: identifier.trim() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push({
        pathname: '/(auth)/otp-verify',
        params: {
          purpose: 'login',
          identifier: identifier.trim(),
          maskedIdentifier: result.maskedIdentifier,
          ...(booking ? { booking } : {}),
          ...(redirect ? { redirect } : {}),
        },
      });
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('common.error'), t('auth.error.generic'));
    }
  }, [identifier, requestOtp, router, t, booking, redirect]);

  return (
    <AquaBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Glass
            variant="strong"
            radius={22}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              goBackOrHome(router);
            }}
            interactive
            accessibilityRole="button"
            accessibilityLabel={t('a11y.buttonBack')}
            style={[styles.backBtn, { alignSelf: dir.alignStart }]}
          >
            {dir.isRTL ? (
              <ChevronRight size={22} color={colors.teal[700]} strokeWidth={1.75} />
            ) : (
              <ChevronLeft size={22} color={colors.teal[700]} strokeWidth={1.75} />
            )}
          </Glass>

          <Animated.View
            entering={FadeIn.duration(700).easing(Easing.out(Easing.cubic))}
            style={styles.logoContainer}
          >
            <Image
              source={require('../../assets/sawa/logo.png')}
              style={styles.logo}
              resizeMode="contain"
              accessible={false}
            />
          </Animated.View>

          <Animated.Text
            entering={FadeInDown.delay(150).duration(700).easing(Easing.out(Easing.cubic))}
            style={[
              styles.title,
              { textAlign: 'center', writingDirection: dir.writingDirection, fontFamily: f700 }
            ]}
          >
            {t('auth.login.title')}
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.delay(250).duration(700).easing(Easing.out(Easing.cubic))}
            style={[
              styles.subtitle,
              { textAlign: 'center', writingDirection: dir.writingDirection, fontFamily: f400, fontWeight: '400' }
            ]}
          >
            {t('auth.welcomeBackSub')}
          </Animated.Text>

          <Animated.View entering={FadeInUp.delay(400).duration(800).easing(Easing.out(Easing.cubic))}>
          <Glass
            variant="regular"
            radius={sawaaTokens.radius.lg}
            style={[styles.form, { marginTop: 32 }]}
          >
            <View style={styles.formInner}>
              <View style={styles.field}>
                <Text
                  style={[
                    styles.label,
                    { textAlign: 'center', writingDirection: dir.writingDirection, fontFamily: f600, fontWeight: '600' }
                  ]}
                >
                  {t('auth.login.identifier')}
                </Text>
                <View style={[styles.input, inputFocused && styles.inputFocused, error ? styles.inputError : undefined]}>
                  <TextInput
                    value={identifier}
                    onChangeText={(text) => {
                      setIdentifier(text.trim());
                      if (error) setError(undefined);
                    }}
                    placeholder={t('auth.login.identifierPlaceholder')}
                    accessibilityLabel={t('auth.login.identifier')}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    autoCorrect={false}
                    selectionColor={colors.teal[600]}
                    placeholderTextColor={colors.ink[500]}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    textContentType="emailAddress"
                    style={[
                      styles.inputText,
                      { textAlign: 'center', writingDirection: 'ltr', fontFamily: f400, fontWeight: '400' }
                    ]}
                  />
                </View>
                {error ? (
                  <Text
                    style={[
                      styles.error,
                      { textAlign: 'center', writingDirection: dir.writingDirection, fontFamily: f400, fontWeight: '400' }
                    ]}
                  >
                    {error}
                  </Text>
                ) : null}
              </View>

              <PrimaryButton
                label={requestOtp.isPending ? t('auth.login.submitting') : t('auth.login.submit')}
                onPress={handleLogin}
                fontFamily={f700}
                disabled={requestOtp.isPending}
                style={{ marginTop: 8 }}
              />

              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (redirect) router.push({ pathname: '/(auth)/forgot-password', params: { redirect } });
                  else router.push('/(auth)/forgot-password');
                }}
                accessibilityRole="link"
                style={[styles.linkTarget, { alignSelf: 'center', marginTop: 4 }]}
              >
                <Text style={[styles.forgotLink, { fontFamily: f600, fontWeight: '600' }]}>
                  {t('auth.forgotPassword.linkLabel')}
                </Text>
              </Pressable>

              <Pressable onPress={() => router.push('/(auth)/review-login')} accessibilityRole="button" style={{ alignSelf: 'center' }}>
                <Text style={[styles.forgotLink, { fontFamily: f600 }]}>{t('auth.review.link')}</Text>
              </Pressable>

              <View style={[styles.registerRow, { flexDirection: dir.row }]}>
                <Text style={[styles.registerText, { fontFamily: f400, fontWeight: '400' }]}>{t('auth.noAccount')} </Text>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    if (booking || redirect) {
                      router.push({
                        pathname: '/(auth)/register',
                        params: {
                          ...(booking ? { booking } : {}),
                          ...(redirect ? { redirect } : {}),
                        },
                      });
                    } else {
                      router.push('/(auth)/register');
                    }
                  }}
                  accessibilityRole="link"
                  style={styles.linkTarget}
                >
                  <Text style={[styles.registerLink, { fontFamily: f700 }]}>{t('auth.createAccount')}</Text>
                </Pressable>
              </View>

              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.replace('/home');
                }}
                accessibilityRole="button"
                style={[styles.linkTarget, { alignSelf: 'center' }]}
              >
                <Text style={[styles.guestLink, { fontFamily: f600, fontWeight: '600' }]}>
                  {t('auth.login.continueAsGuest')}
                </Text>
              </Pressable>
            </View>
          </Glass>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 24 },
  logoContainer: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  logo: { width: 144, height: 144, tintColor: colors.teal[700] },
  title: { fontSize: 32, color: colors.teal[700], lineHeight: 42, marginBottom: 8, alignSelf: 'stretch' },
  subtitle: { fontSize: 14, color: colors.ink[500], lineHeight: 20, marginBottom: 32, alignSelf: 'stretch' },
  form: { padding: 24 },
  formInner: { gap: 20 },
  field: { gap: 10 },
  label: { fontSize: 14, color: colors.teal[700] },
  input: { minHeight: 56, paddingHorizontal: 16, borderRadius: sawaaTokens.radius.md, borderWidth: 1, borderColor: colors.teal[200], backgroundColor: colors.glass.opaqueBg, flexDirection: 'row', alignItems: 'center' },
  inputFocused: { borderColor: colors.teal[600], backgroundColor: colors.glass.opaqueBg },
  inputError: { borderColor: colors.accent.coral },
  inputRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', width: '100%' },
  inputText: { flex: 1, minHeight: 56, paddingVertical: 12, fontSize: 16, color: colors.ink[900] },
  error: { fontSize: 12, color: colors.accent.coral },
  linkTarget: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  guestLink: { fontSize: 13, color: colors.ink[500], textAlign: 'center' },
  forgotLink: { fontSize: 13, color: colors.teal[600], textAlign: 'center' },
  registerRow: { alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 8 },
  registerText: { fontSize: 14, color: colors.ink[500], textAlign: 'center' },
  registerLink: { fontSize: 14, color: colors.teal[700], textAlign: 'center' },
});
