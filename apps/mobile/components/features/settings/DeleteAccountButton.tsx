import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react-native';

import { authService } from '@/services/auth';
import { MenuGroup } from '@/components/ui/MenuGroup';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';

/**
 * Delete-account row. Pressing it opens a confirmation sheet that lists the
 * consequences and keeps the delete action disabled until the client types
 * the confirmation word.
 */
export function DeleteAccountButton() {
  const { t } = useTranslation();
  const router = useRouter();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const closeAccount = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      await authService.requestAccountDeletion();
      setOpen(false);
      router.replace('/(guest)/home');
    } catch {
      Alert.alert(t('profile.deleteAccountTitle'), t('profile.deleteAccountError'));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  return (
    <>
      <MenuGroup entries={[{
        key: 'delete-account',
        icon: Trash2,
        label: t('profile.deleteAccount'),
        danger: true,
        busy,
        onPress: () => setOpen(true),
      }]} />
      <ConfirmSheet
        visible={open}
        icon={Trash2}
        title={t('profile.deleteAccountSheetTitle')}
        body={t('profile.deleteAccountBody')}
        points={[
          t('profile.deleteAccountPointSignIn'),
          t('profile.deleteAccountPointContact'),
          t('profile.deleteAccountPointRecords'),
        ]}
        confirmPhrase={t('profile.deleteAccountPhrase')}
        confirmPhraseLabel={t('profile.deleteAccountPhraseLabel', { phrase: t('profile.deleteAccountPhrase') })}
        confirmLabel={t('profile.deleteAccountAction')}
        cancelLabel={t('profile.deleteAccountCancel')}
        busy={busy}
        onConfirm={() => { void closeAccount(); }}
        onCancel={() => { if (!busy) setOpen(false); }}
      />
    </>
  );
}
