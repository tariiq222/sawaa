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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { AquaBackground, PrimaryButton } from '@/theme/sawaa';
import { useDir } from '@/hooks/useDir';
import { useRegister } from '@/hooks/queries';
import { getFontName } from '@/theme/fonts';
import { LabeledInput } from '@/components/ui/LabeledInput';
import { authContinuationParams } from '@/features/booking/guest-booking-flow';

export default function RegisterScreen() {
  const { booking, redirect } = useLocalSearchParams<{ booking?: string; redirect?: string }>();
  const router = useRouter();
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const dir = useDir();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const register = useRegister();

  const clearError = (field: string) => {
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    if (!firstName.trim()) newErrors.firstName = t('auth.register.firstNameError');
    if (!lastName.trim()) newErrors.lastName = t('auth.register.lastNameError');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) newErrors.email = t('auth.register.emailError');
    if (!phone.trim()) newErrors.phone = t('auth.register.phoneError');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [firstName, lastName, email, phone, t]);

  const handleRegister = useCallback(async () => {
    if (!validate()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    try {
      const result = await register.mutateAsync({ firstName, lastName, phone, email });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push({
        pathname: '/(auth)/otp-verify',
        params: {
          purpose: 'register',
          identifier: phone,
          maskedIdentifier: result.maskedPhone,
          ...authContinuationParams(booking, redirect),
          // Needed by the OTP screen to re-send the code: the backend re-sends
          // the register OTP when the same details are submitted again.
          firstName,
          lastName,
          email,
        },
      });
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('common.error'), t('auth.registerError'));
    }
  }, [firstName, lastName, phone, email, validate, register, router, t, booking, redirect]);

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
          <ScreenHeader title={t('auth.register.title')} onBack={() => router.back()} />

          <Text
            style={[
              styles.subtitle,
              { textAlign: dir.textAlign, writingDirection: dir.writingDirection, fontFamily: getFontName(dir.locale, '400') },
            ]}
          >
            {t('auth.createAccountSub')}
          </Text>

          <View style={styles.form}>
            <View style={[styles.row, { flexDirection: dir.row }]}>
              <View style={styles.half}>
                <LabeledInput
                  label={t('auth.register.firstName')}
                  value={firstName}
                  onChangeText={(v) => {
                    setFirstName(v);
                    clearError('firstName');
                  }}
                  placeholder={t('auth.firstNamePlaceholder')}
                  error={errors.firstName}
                  dir={dir}
                />
              </View>
              <View style={styles.half}>
                <LabeledInput
                  label={t('auth.register.lastName')}
                  value={lastName}
                  onChangeText={(v) => {
                    setLastName(v);
                    clearError('lastName');
                  }}
                  placeholder={t('auth.lastNamePlaceholder')}
                  error={errors.lastName}
                  dir={dir}
                />
              </View>
            </View>

            <LabeledInput
              label={t('auth.register.phone')}
              value={phone}
              onChangeText={(v) => {
                setPhone(v);
                clearError('phone');
              }}
              placeholder={t('auth.phonePlaceholder')}
              error={errors.phone}
              keyboardType="phone-pad"
              dir={dir}
            />

            <LabeledInput
              label={t('auth.register.email')}
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                clearError('email');
              }}
              placeholder={t('auth.emailPlaceholder')}
              error={errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              dir={dir}
            />

            <PrimaryButton
              label={register.isPending ? t('auth.register.submitting') : t('auth.register.submit')}
              onPress={handleRegister}
              fontFamily={getFontName(dir.locale, '700')}
              disabled={register.isPending}
              style={styles.primary}
            />

            <View style={[styles.loginRow, { flexDirection: dir.row }]}>
              <Text style={[styles.loginText, { fontFamily: getFontName(dir.locale, '400') }]}>{t('auth.hasAccount')} </Text>
              <Pressable
                accessibilityRole="link"
                style={styles.linkTarget}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.back();
                }}
              >
                <Text style={[styles.loginLink, { fontFamily: getFontName(dir.locale, '700') }]}>{t('auth.login')}</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 16 },
  subtitle: { fontSize: 15, lineHeight: 24, color: colors.ink[700], marginTop: 16 },
  form: { marginTop: 20, gap: 16 },
  row: { gap: 12 },
  half: { flex: 1 },
  primary: { marginTop: 8 },
  loginRow: { alignItems: 'center', justifyContent: 'center' },
  linkTarget: { minHeight: 44, justifyContent: 'center' },
  loginText: { fontSize: 14, color: colors.ink[700] },
  loginLink: { fontSize: 14, color: colors.teal[700] },
});
