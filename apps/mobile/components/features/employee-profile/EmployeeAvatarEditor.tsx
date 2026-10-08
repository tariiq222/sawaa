import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { AppButton } from '@/components/ui/AppButton';
import { Thumb } from '@/components/ui/Thumb';
import { ThemedText } from '@/theme/components/ThemedText';
import { useTheme } from '@/theme/useTheme';
import type { AvatarUpload } from '@/services/employee/profile';

export function EmployeeAvatarEditor({ uri, upload, remove, busy }: { uri: string | null; upload: (image: AvatarUpload) => Promise<unknown>; remove: () => Promise<unknown>; busy: boolean }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [error, setError] = useState('');
  const [picking, setPicking] = useState(false);
  const choose = async () => {
    setError(''); setPicking(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { setError('employeeSelfProfile.photoPermission'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const type = asset.mimeType ?? 'image/jpeg';
      if ((asset.fileSize ?? 0) > 1048576 || !['image/png', 'image/jpeg', 'image/webp'].includes(type)) { setError('employeeSelfProfile.invalidPhoto'); return; }
      const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
      await upload({ uri: asset.uri, type, name: asset.fileName ?? `profile.${ext}` });
    } catch { setError('employeeSelfProfile.photoError'); }
    finally { setPicking(false); }
  };
  const clear = async () => {
    setError('');
    try { await remove(); } catch { setError('employeeSelfProfile.photoError'); }
  };
  return <View style={styles.form}>
    <View style={styles.photo}><Thumb uri={uri} width={96} height={96} radius={48} accessibilityLabel={t('employeeSelfProfile.photo')} /></View>
    <AppButton label={t('employeeSelfProfile.changePhoto')} onPress={choose} loading={busy || picking} variant="secondary" />
    {uri ? <AppButton label={t('employeeSelfProfile.removePhoto')} onPress={clear} disabled={busy || picking} variant="ghost" /> : null}
    <ThemedText variant="caption">{t('employeeSelfProfile.photoHint')}</ThemedText>
    {error ? <ThemedText accessibilityRole="alert" color={theme.colors.error}>{t(error)}</ThemedText> : null}
  </View>;
}
const styles = StyleSheet.create({ form: { gap: 12 }, photo: { alignItems: 'center' } });
