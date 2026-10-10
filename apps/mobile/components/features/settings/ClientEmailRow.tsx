import React from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Mail } from 'lucide-react-native';
import { MenuGroup, type MenuEntry } from '@/components/ui/MenuGroup';
import { useClientEmailStatus } from '@/hooks/queries';

/**
 * Personal-details email row. A verified address displays read-only (LTR);
 * pending or missing email opens the code-verified email screen. Legacy
 * unverified addresses are never shown — the status API only returns a
 * verified `email`.
 */
export function ClientEmailRow() {
  const { t } = useTranslation();
  const router = useRouter();
  const status = useClientEmailStatus().data;
  if (!status) return null;
  const label = t('profile.email.label');
  let value = t('profile.email.add');
  if (status.status === 'verified') value = status.email ?? '';
  else if (status.status === 'pending') value = t('profile.email.confirmPending');
  const entry: MenuEntry = {
    key: 'email',
    icon: Mail,
    label,
    value,
    valueDirection: status.status === 'verified' ? 'ltr' : 'auto',
    onPress: () => router.push({ pathname: '/(client)/email-verify', params: { mode: 'manage' } }),
  };
  return <MenuGroup entries={[entry]} />;
}
