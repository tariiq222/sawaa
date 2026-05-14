import { useState, useCallback } from 'react';
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
} from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Glass } from '@/theme';
import { sawaaTokens, sawaaColors } from '@/theme/sawaa/tokens';
import { AquaBackground, PrimaryButton } from '@/theme/sawaa';
import { useDir } from '@/hooks/useDir';
import { useRequestLoginOtp } from '@/hooks/queries';
import { getFontName } from '@/theme/fonts';

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');

  const [identifier, setIdentifier] = useState('');
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
        },
      });
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('common.error'), t('error.generic'));
    }
  }, [identifier, requestOtp, router, t]);

  return (
    <AquaBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            entering={FadeIn.duration(700).easing(Easing.out(Easing.cubic))}
            style={styles.logoContainer}
          >
            <Glass variant="strong" radius={sawaaTokens.radius.xl} style={styles.logo}>
              <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 2C7 6 4 10 4 14a8 8 0 0 0 16 0c0-4-3-8-8-12Z"
                  stroke={sawaaColors.teal[700]}
                  strokeWidth={1.7}
                  strokeLinejoin="round"
                />
                <Path
                  d="M12 22V10"
                  stroke={sawaaColors.teal[700]}
                  strokeWidth={1.7}
                  strokeLinecap="round"
                />
              </Svg>
            </Glass>
          </Animated.View>

          <Animated.Text
            entering={FadeInDown.delay(150).duration(700).easing(Easing.out(Easing.cubic))}
            style={[
              styles.title,
              { textAlign: dir.textAlign, writingDirection: dir.writingDirection, fontFamily: f700 }
            ]}
          >
            {t('auth.login.title')}
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.delay(250).duration(700).easing(Easing.out(Easing.cubic))}
            style={[
              styles.subtitle,
              { textAlign: dir.textAlign, writingDirection: dir.writingDirection, fontFamily: f400 }
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
                    { textAlign: dir.textAlign, writingDirection: dir.writingDirection, fontFamily: f600 }
                  ]}
                >
                  {t('auth.login.identifier')}
                </Text>
                <Glass variant="clear" radius={sawaaTokens.radius.md} style={styles.input}>
                  <TextInput
                    value={identifier}
                    onChangeText={(text) => {
                      setIdentifier(text.trim());
                      if (error) setError(undefined);
                    }}
                    placeholder={t('auth.login.identifier')}
                    placeholderTextColor={sawaaColors.ink[500]}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    textContentType="emailAddress"
                    style={[
                      styles.inputText,
                      { textAlign: 'left', writingDirection: 'ltr', fontFamily: f400 }
                    ]}
                  />
                </Glass>
                {error ? (
                  <Text
                    style={[
                      styles.error,
                      { textAlign: dir.textAlign, writingDirection: dir.writingDirection, fontFamily: f400 }
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

              <View style={[styles.registerRow, { flexDirection: dir.row }]}>
                <Text style={[styles.registerText, { fontFamily: f400 }]}>{t('auth.noAccount')} </Text>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push('/(auth)/register');
                  }}
                >
                  <Text style={[styles.registerLink, { fontFamily: f700 }]}>{t('auth.createAccount')}</Text>
                </Pressable>
              </View>
            </View>
          </Glass>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 24 },
  logoContainer: { alignItems: 'center', marginBottom: 24 },
  logo: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 32, color: sawaaColors.teal[700], lineHeight: 42, marginBottom: 8, alignSelf: 'stretch' },
  subtitle: { fontSize: 14, color: sawaaColors.ink[500], lineHeight: 20, marginBottom: 32, alignSelf: 'stretch' },
  form: { padding: 24 },
  formInner: { gap: 20 },
  field: { gap: 8 },
  label: { fontSize: 14, color: sawaaColors.teal[700] },
  input: { padding: 14, flexDirection: 'row', alignItems: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', width: '100%' },
  inputText: { flex: 1, fontSize: 14, color: sawaaColors.teal[700] },
  error: { fontSize: 12, color: sawaaColors.accent.coral },
  registerRow: { alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 8 },
  registerText: { fontSize: 14, color: sawaaColors.ink[500] },
  registerLink: { fontSize: 14, color: sawaaColors.teal[700] },
});
