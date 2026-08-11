import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageCircle } from 'lucide-react-native';

import { AquaBackground, sawaaColors, sawaaRadius } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { useBranding } from '@/hooks/queries/useBranding';

function normalizeWhatsappPhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0')) return `966${digits.slice(1)}`;
  return digits || null;
}

export default function ChatTabScreen() {
  const { t } = useTranslation();
  const dir = useDir();
  const insets = useSafeAreaInsets();
  const branding = useBranding();
  const phone = normalizeWhatsappPhone(branding.data?.contactPhone);
  const font = getFontName(dir.locale, '500');
  const titleFont = getFontName(dir.locale, '700');

  const openWhatsapp = () => {
    if (!phone) return;
    const message = dir.isRTL ? 'مرحباً، أحتاج إلى مساعدة.' : 'Hello, I need help.';
    void Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`);
  };

  return (
    <AquaBackground>
      <View style={[styles.container, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.iconWrap}>
          <MessageCircle size={34} color={sawaaColors.teal[700]} strokeWidth={1.8} />
        </View>
        <Text style={[styles.title, { fontFamily: titleFont, textAlign: dir.textAlign }]}>
          {t('whatsapp.title')}
        </Text>
        <Text style={[styles.description, { fontFamily: font, textAlign: dir.textAlign }]}>
          {t('whatsapp.description')}
        </Text>
        <Pressable onPress={openWhatsapp} disabled={!phone} style={styles.button} accessibilityRole="button">
          <Glass variant="strong" radius={sawaaRadius.pill} style={[styles.buttonGlass, !phone && styles.disabled]}>
            <MessageCircle size={20} color={sawaaColors.teal[700]} strokeWidth={2} />
            <Text style={[styles.buttonText, { fontFamily: font }]}>{t('whatsapp.open')}</Text>
          </Glass>
        </Pressable>
        {!phone && (
          <Text style={[styles.unavailable, { fontFamily: font, textAlign: dir.textAlign }]}>
            {t('whatsapp.unavailable')}
          </Text>
        )}
      </View>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  iconWrap: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: sawaaColors.teal[50], marginBottom: 20 },
  title: { fontSize: 22, color: sawaaColors.ink[900], marginBottom: 10 },
  description: { maxWidth: 330, fontSize: 15, lineHeight: 25, color: sawaaColors.ink[500], marginBottom: 24 },
  button: { width: '100%', maxWidth: 330 },
  buttonGlass: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  buttonText: { fontSize: 15, color: sawaaColors.teal[700] },
  disabled: { opacity: 0.5 },
  unavailable: { marginTop: 12, fontSize: 12, color: sawaaColors.ink[500] },
});
