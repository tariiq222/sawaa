import React from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Phone } from 'lucide-react-native';
import { MenuGroup, type MenuEntry } from '@/components/ui/MenuGroup';
import { useAppSelector } from '@/hooks/use-redux';

/**
 * Personal-details phone row. The current number is read-only (LTR); the
 * number can only be changed through the SMS-verified phone screen, never a
 * free-text form field.
 */
export function ClientPhoneRow() {
  const { t } = useTranslation();
  const router = useRouter();
  const phone = useAppSelector((state) => state.auth.user?.phone);
  const entry: MenuEntry = {
    key: 'phone',
    icon: Phone,
    label: t('profile.phone.label'),
    value: phone ?? '',
    valueDirection: 'ltr',
    onPress: () => router.push('/(client)/phone-verify'),
  };
  return <MenuGroup entries={[entry]} />;
}
