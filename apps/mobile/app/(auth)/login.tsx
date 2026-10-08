import { useState, useCallback, useMemo, useRef } from 'react';
import { usePasswordLogin } from '@/features/auth/use-password-login';
import EmailEntryScreen from './email-entry';
import {
  View,
  Text,
  Pressable,
  Alert,
  StyleSheet,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';

import { Glass } from '@/theme/components/Glass';
import { AuthFormScaffold } from '@/components/features/auth/AuthFormScaffold';
import { LabeledInput } from '@/components/ui/LabeledInput';
import { AppButton } from '@/components/ui/AppButton';
import { sawaaTokens, sawaaType } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
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
    <AuthFormScaffold onBack={() => { leave(); goBackOrHome(router); }}>
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
      {(['password', 'otp'] as const).map(value => <Pressable key={value} accessibilityRole="tab"
        accessibilityState={{ selected: mode === value }} style={[styles.mode, mode === value && styles.selectedMode]}
        onPress={() => { leave(); setMode(value); setError(undefined); setVisible(false); }}>
        <Text style={[styles.smallLink, { fontFamily: f700 }]}>{t(value === 'password' ? 'auth.loginWithPassword' : 'auth.loginWithOtp')}</Text>
      </Pressable>)}
    </View>

    <LabeledInput label={t('auth.login.identifier')} value={identifier} dir={dir}
      onChangeText={text => { setIdentifier(text.trim()); if (error) setError(undefined); }}
      placeholder={t('auth.login.identifierPlaceholder')} error={error} autoCorrect={false}
      keyboardType="email-address" autoCapitalize="none" autoComplete="username" textContentType="username" editable={!passwordLogin.pending}
      inputStyle={{ textAlign: 'left', writingDirection: 'ltr' }} />

    {mode === 'password' && <View style={styles.passwordField}>
      <LabeledInput label={t('auth.password')} value={password} dir={dir}
        onChangeText={value => { setPassword(value); setError(undefined); }} secureTextEntry={!visible}
        editable={!passwordLogin.pending} autoCapitalize="none" autoCorrect={false}
        autoComplete="password" textContentType="password" onSubmitEditing={handleLogin}
        inputStyle={{ textAlign: 'left', writingDirection: 'ltr' }} />
      <AppButton variant="ghost" size="sm" label={t(visible ? 'auth.hidePassword' : 'auth.showPassword')}
        onPress={() => setVisible(!visible)} />
    </View>}

    <AppButton
      label={t(mode === 'password' ? 'auth.loginNow' : 'auth.login.sendCode')}
      onPress={handleLogin}
      disabled={requestOtp.isPending || passwordLogin.pending} loading={requestOtp.isPending || passwordLogin.pending}
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

    {booking ? null : <AppButton label={t('auth.login.continueAsGuest')} variant="secondary"
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); leave(); router.replace('/(guest)/home'); }} />}


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

  </AuthFormScaffold>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  logoWrap: { alignItems: 'center', marginBottom: 20 },
  logoCard: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 60, height: 60, tintColor: colors.teal[700] },
  title: { fontSize: sawaaType.heading.fontSize, lineHeight: sawaaType.heading.lineHeight, color: colors.ink[900] },
  subtitle: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight, color: colors.ink[700], marginTop: 8, marginBottom: 28 },
  modes: { gap: 8, marginBottom: 20 },
  mode: { flex: 1, minHeight: 48, justifyContent: 'center', borderWidth: 1, borderColor: colors.teal[200], borderRadius: sawaaTokens.radius.lg },
  selectedMode: { borderColor: colors.teal[700], backgroundColor: colors.teal[100] },
  passwordField: { gap: 8, marginTop: 16 },
  primary: { marginTop: 16 },
  registerRow: { flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  registerText: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight, color: colors.ink[700], textAlign: 'center' },
  registerLink: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight, color: colors.teal[700], textAlign: 'center' },
  linkTarget: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center', alignSelf: 'center' },
  smallLink: { fontSize: sawaaType.bodySm.fontSize, lineHeight: sawaaType.bodySm.lineHeight, color: colors.teal[700], textAlign: 'center' },
});
