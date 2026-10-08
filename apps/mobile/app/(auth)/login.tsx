import { useState, useCallback, useMemo } from 'react';
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
import { PrimaryButton } from '@/theme/sawaa';
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

  const [identifier, setIdentifier] = useState('');
  const [emailEntry, setEmailEntry] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const requestOtp = useRequestLoginOtp();
  const continuation = authContinuationParams(booking, redirect);
  const forgotPasswordHref = booking || redirect
    ? { pathname: '/(auth)/forgot-password' as const, params: continuation }
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

    if (identifier.includes('@')) { setEmailEntry(true); return; }

    try {
      const result = await requestOtp.mutateAsync({ identifier: identifier.trim() });
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('common.error'), t('auth.error.generic'));
    }
  }, [identifier, requestOtp, router, t, booking, redirect]);

  const centered = { textAlign: 'center', writingDirection: dir.writingDirection } as const;

  if (emailEntry) return <EmailEntryScreen initialEmail={identifier.trim()} onExit={() => { setEmailEntry(false); setIdentifier(''); }} />;

  return (
    <AuthFormScaffold onBack={() => goBackOrHome(router)}>
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

    <LabeledInput label={t('auth.login.identifier')} value={identifier} dir={dir}
      onChangeText={text => { setIdentifier(text.trim()); if (error) setError(undefined); }}
      placeholder={t('auth.login.identifierPlaceholder')} error={error} autoCorrect={false}
      keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress"
      inputStyle={{ textAlign: 'left', writingDirection: 'ltr' }} />

    <PrimaryButton
      label={t('auth.login.sendCode')}
      onPress={handleLogin}
      fontFamily={f700}
      disabled={requestOtp.isPending} loading={requestOtp.isPending}
      style={styles.primary}
    />

    <View style={[styles.registerRow, { flexDirection: dir.row }]}>
      <Text style={[styles.registerText, { fontFamily: f400, fontWeight: '400' }]}>{t('auth.noAccount')} </Text>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push(registerHref);
        }}
        accessibilityRole="link"
        style={styles.linkTarget}
      >
        <Text style={[styles.registerLink, { fontFamily: f700 }]}>{t('auth.createAccount')}</Text>
      </Pressable>
    </View>

    {booking ? null : <AppButton label={t('auth.login.continueAsGuest')} variant="secondary"
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.replace('/(guest)/home'); }} />}


    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(forgotPasswordHref);
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
        router.push({ pathname: '/(auth)/review-login', params: authContinuationParams(booking, redirect) });
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
  primary: { marginTop: 16 },
  registerRow: { flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  registerText: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight, color: colors.ink[700], textAlign: 'center' },
  registerLink: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight, color: colors.teal[700], textAlign: 'center' },
  linkTarget: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center', alignSelf: 'center' },
  smallLink: { fontSize: sawaaType.bodySm.fontSize, lineHeight: sawaaType.bodySm.lineHeight, color: colors.teal[700], textAlign: 'center' },
});
