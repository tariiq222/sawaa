import { useState, useCallback, useMemo, useRef } from 'react';
import { usePasswordLogin } from '@/features/auth/use-password-login';
import EmailEntryScreen from './email-entry';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Glass } from '@/theme';
import { BackButton } from '@/components/ui/BackButton';
import { sawaaTokens } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { AquaBackground, PrimaryButton } from '@/theme/sawaa';
import { useDir } from '@/hooks/useDir';
import { useRequestLoginOtp } from '@/hooks/queries';
import { getFontName } from '@/theme/fonts';
import { goBackOrHome } from '@/lib/navigation';
import { authContinuationParams } from '@/features/booking/guest-booking-flow';

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

  const [mode, setMode] = useState<'password' | 'otp'>('password');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const otpBusy = useRef(false);
  const passwordLogin = usePasswordLogin({ booking, redirect });
  const leave = () => { passwordLogin.cancel(); otpBusy.current = false; setPassword(''); };
  const [identifier, setIdentifier] = useState('');
  const [emailEntry, setEmailEntry] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const requestOtp = useRequestLoginOtp();
  const continuation = authContinuationParams(booking, redirect);
  const forgotPasswordHref = booking || redirect || identifier.trim()
    ? { pathname: '/(auth)/forgot-password' as const, params: { ...continuation, ...(identifier.trim() ? { identifier: identifier.trim() } : {}) } }
    : '/(auth)/forgot-password';
  const registerHref = booking || redirect
    ? { pathname: '/(auth)/register' as const, params: continuation }
    : '/(auth)/register';

  const handleLogin = useCallback(async () => {
    if (!identifier.trim()) {
      setError(t('auth.login.identifierError'));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (mode === 'password') {
      if (!password) { setError(t('auth.passwordRequired')); return; }
      const result = await passwordLogin.submit(identifier, password);
      if (result === 'failed') setError(t('auth.loginError'));
      if (result !== 'cancelled') setPassword('');
      return;
    }
    if (otpBusy.current) return;
    if (identifier.includes('@')) { setEmailEntry(true); return; }

    otpBusy.current = true;
    const current = passwordLogin.capture();
    try {
      const result = await requestOtp.mutateAsync({ identifier: identifier.trim() });
      if (!current()) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push({
        pathname: '/(auth)/otp-verify',
        params: {
          purpose: 'login',
          identifier: identifier.trim(),
          maskedIdentifier: result.maskedIdentifier,
          ...authContinuationParams(booking, redirect),
        },
      });
    } catch {
      if (!current()) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('common.error'), t('auth.error.generic'));
    } finally { if (current()) otpBusy.current = false; }
  }, [identifier, requestOtp, router, t, booking, redirect, mode, password, passwordLogin]);

  const centered = { textAlign: 'center', writingDirection: dir.writingDirection } as const;

  if (emailEntry) return <EmailEntryScreen initialEmail={identifier.trim()} autoStart onExit={() => setEmailEntry(false)} />;

  return (
    <AquaBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <BackButton onPress={() => { leave(); goBackOrHome(router); }} style={[styles.backBtn, { alignSelf: dir.alignStart }]} />

          <View style={styles.logoWrap}>
            <Glass variant="strong" radius={sawaaTokens.radius.xl} style={styles.logoCard}>
              <Image
                source={require('../../assets/sawa/logo.png')}
                style={styles.logo}
                resizeMode="contain"
                accessible={false}
              />
            </Glass>
          </View>

          <Text accessibilityRole="header" style={[styles.title, centered, { fontFamily: f700 }]}>
            {t('auth.login.welcome')}
          </Text>
          <Text style={[styles.subtitle, centered, { fontFamily: f400, fontWeight: '400' }]}>
            {t('auth.login.subtitle')}
          </Text>

          <View style={[styles.modes, { flexDirection: dir.row }]}>
            {(['password', 'otp'] as const).map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: mode === value }} onPress={() => { leave(); setMode(value); setError(undefined); setVisible(false); }} style={[styles.mode, mode === value && styles.inputFocused]}>
              <Text style={[styles.smallLink, { fontFamily: f700 }]}>{t(value === 'password' ? 'auth.loginWithPassword' : 'auth.loginWithOtp')}</Text>
            </Pressable>)}
          </View>
          <View style={styles.field}>
            <Text style={[styles.label, { textAlign: dir.textAlign, writingDirection: dir.writingDirection, fontFamily: f700 }]}>
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
                autoComplete="username"
                textContentType="username"
                editable={!passwordLogin.pending}
                style={[styles.inputText, { textAlign: 'center', writingDirection: 'ltr', fontFamily: f400, fontWeight: '400' }]}
              />
            </View>
            {error ? (
              <Text accessibilityRole="alert" style={[styles.error, centered, { fontFamily: f400, fontWeight: '400' }]}>{error}</Text>
            ) : null}
          </View>

          {mode === 'password' && <View style={[styles.field, { marginTop: 16 }]}>
            <Text style={[styles.label, { textAlign: dir.textAlign, fontFamily: f700 }]}>{t('auth.password')}</Text>
            <View style={[styles.input, { flexDirection: dir.row }]}>
              <TextInput accessibilityLabel={t('auth.password')} value={password} onChangeText={value => { setPassword(value); setError(undefined); }} secureTextEntry={!visible} editable={!passwordLogin.pending} autoCapitalize="none" autoCorrect={false} autoComplete="password" textContentType="password" onSubmitEditing={handleLogin} style={[styles.inputText, { fontFamily: f400, textAlign: 'left', writingDirection: 'ltr' }]} />
              <Pressable accessibilityRole="button" accessibilityLabel={t(visible ? 'auth.hidePassword' : 'auth.showPassword')} onPress={() => setVisible(!visible)} style={styles.linkTarget}><Text style={styles.smallLink}>{t(visible ? 'auth.hidePassword' : 'auth.showPassword')}</Text></Pressable>
            </View>
          </View>}
          <PrimaryButton
            label={requestOtp.isPending || passwordLogin.pending ? t('auth.login.submitting') : t(mode === 'password' ? 'auth.loginNow' : 'auth.login.sendCode')}
            onPress={handleLogin}
            fontFamily={f700}
            disabled={requestOtp.isPending || passwordLogin.pending}
            style={styles.primary}
          />

          <View style={[styles.registerRow, { flexDirection: dir.row }]}>
            <Text style={[styles.registerText, { fontFamily: f400, fontWeight: '400' }]}>{t('auth.noAccount')} </Text>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                leave(); router.push(registerHref);
              }}
              accessibilityRole="link"
              style={styles.linkTarget}
            >
              <Text style={[styles.registerLink, { fontFamily: f700 }]}>{t('auth.createAccount')}</Text>
            </Pressable>
          </View>

          {booking ? null : (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                leave(); router.replace('/(guest)/home');
              }}
              accessibilityRole="button"
              style={styles.secondary}
            >
              <Text style={[styles.secondaryText, { fontFamily: f700 }]}>{t('auth.login.continueAsGuest')}</Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              leave(); router.push(forgotPasswordHref);
            }}
            accessibilityRole="link"
            style={styles.linkTarget}
          >
            <Text style={[styles.smallLink, { fontFamily: f600, fontWeight: '600' }]}>
              {t('auth.forgotPassword.linkLabel')}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              leave(); router.push({ pathname: '/(auth)/review-login', params: authContinuationParams(booking, redirect) });
            }}
            accessibilityRole="button"
            style={styles.linkTarget}
          >
            <Text style={[styles.smallLink, { fontFamily: f600 }]}>{t('auth.review.link')}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 16 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  logoWrap: { alignItems: 'center', marginBottom: 20 },
  logoCard: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 60, height: 60, tintColor: colors.teal[700] },
  title: { fontSize: 28, lineHeight: 38, color: colors.ink[900] },
  subtitle: { fontSize: 15, lineHeight: 24, color: colors.ink[700], marginTop: 8, marginBottom: 28 },
  modes: { gap: 8, marginBottom: 20 },
  mode: { flex: 1, minHeight: 48, justifyContent: 'center', borderWidth: 1, borderColor: colors.teal[200], borderRadius: sawaaTokens.radius.lg },
  field: { gap: 8 },
  label: { fontSize: 14, lineHeight: 20, color: colors.ink[900] },
  input: {
    minHeight: 56,
    paddingHorizontal: 16,
    borderRadius: sawaaTokens.radius.lg,
    borderWidth: 1,
    borderColor: colors.teal[200],
    backgroundColor: colors.glass.opaqueBg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputFocused: { borderColor: colors.teal[600] },
  inputError: { borderColor: colors.accent.coral },
  inputText: { flex: 1, minHeight: 54, paddingVertical: 12, fontSize: 16, color: colors.ink[900] },
  error: { fontSize: 13, color: colors.accent.coral },
  primary: { marginTop: 16 },
  registerRow: { alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  registerText: { fontSize: 14, color: colors.ink[700], textAlign: 'center' },
  registerLink: { fontSize: 14, color: colors.teal[700], textAlign: 'center' },
  linkTarget: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center', alignSelf: 'center' },
  secondary: {
    minHeight: 56,
    marginTop: 12,
    borderRadius: sawaaTokens.radius.pill,
    borderWidth: 1,
    borderColor: colors.teal[700],
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontSize: 16, color: colors.teal[700] },
  smallLink: { fontSize: 13, color: colors.teal[700], textAlign: 'center' },
});
