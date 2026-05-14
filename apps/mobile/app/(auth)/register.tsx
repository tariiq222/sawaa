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
  ImageBackground,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { Glass } from '@/theme';
import { sawaaTokens, sawaaColors } from '@/theme/sawaa/tokens';
import { PrimaryButton } from '@/theme/sawaa';
import { useDir } from '@/hooks/useDir';
import { useRegister } from '@/hooks/queries';
import { LabeledInput } from '@/components/ui/LabeledInput';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
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
        },
      });
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('common.error'), t('auth.registerError'));
    }
  }, [firstName, lastName, phone, email, validate, register, router, t]);

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('@/assets/bg.jpg')}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Glass
            variant="strong"
            radius={22}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            interactive
            style={styles.backBtn}
          >
            {dir.isRTL ? (
              <ChevronRight size={22} color={sawaaColors.teal[700]} strokeWidth={1.75} />
            ) : (
              <ChevronLeft size={22} color={sawaaColors.teal[700]} strokeWidth={1.75} />
            )}
          </Glass>

          <Text
            style={[
              styles.title,
              { textAlign: dir.textAlign, writingDirection: dir.writingDirection },
            ]}
          >
            {t('auth.register.title')}
          </Text>
          <Text
            style={[
              styles.subtitle,
              { textAlign: dir.textAlign, writingDirection: dir.writingDirection },
            ]}
          >
            {t('auth.createAccountSub')}
          </Text>

          <Glass variant="regular" radius={sawaaTokens.radius.lg} style={[styles.form, { marginTop: 24 }]}>
            <View style={styles.formInner}>
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
                disabled={register.isPending}
                style={{ marginTop: 8 }}
              />

              <View style={[styles.loginRow, { flexDirection: dir.row }]}>
                <Text style={styles.loginText}>{t('auth.hasAccount')} </Text>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.back();
                  }}
                >
                  <Text style={styles.loginLink}>{t('auth.login')}</Text>
                </Pressable>
              </View>
            </View>
          </Glass>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 24 },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  title: { fontSize: 32, fontWeight: '800', color: sawaaColors.teal[700], lineHeight: 42, marginBottom: 8 },
  subtitle: { fontSize: 14, color: sawaaColors.ink[500], lineHeight: 20 },
  form: { padding: 24 },
  formInner: { gap: 16 },
  row: { gap: 12 },
  half: { flex: 1 },
  loginRow: { alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 8 },
  loginText: { fontSize: 14, color: sawaaColors.ink[500] },
  loginLink: { fontSize: 14, fontWeight: '700', color: sawaaColors.teal[700] },
});
