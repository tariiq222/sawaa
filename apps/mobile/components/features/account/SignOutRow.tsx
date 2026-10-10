import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { LogOut } from 'lucide-react-native';

import { authService } from '@/services/auth';
import { MenuGroup } from '@/components/ui/MenuGroup';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';

/** Sign-out row with the shared confirmation sheet, used by every signed-in role. */
export function SignOutRow() {
  const { t } = useTranslation();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    setBusy(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await authService.logout();
      setOpen(false);
      router.replace('/(guest)/home');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <MenuGroup entries={[{ key: 'sign-out', icon: LogOut, label: t('profile.signOut'), danger: true, onPress: () => setOpen(true) }]} />
      <ConfirmSheet
        visible={open}
        icon={LogOut}
        tone="primary"
        title={t('profile.signOut')}
        body={t('profile.logoutConfirm')}
        confirmLabel={t('profile.signOut')}
        cancelLabel={t('common.cancel')}
        busy={busy}
        onConfirm={() => { void signOut(); }}
        onCancel={() => { if (!busy) setOpen(false); }}
      />
    </>
  );
}
