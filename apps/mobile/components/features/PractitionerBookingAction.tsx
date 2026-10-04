import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Href } from 'expo-router';

import type { PublicService } from '@/services/client/catalog';
import { sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useTheme } from '@/theme/useTheme';
import { getFontName } from '@/theme/fonts';
import { useDir } from '@/hooks/useDir';
import { getBookableServices, practitionerBookingRoute, type PractitionerBookingEmployee } from './practitionerBooking';

interface Props {
  employee: PractitionerBookingEmployee;
  catalogServices: PublicService[];
  t: (key: string, options?: Record<string, string>) => string;
  onNavigate: (route: Href) => void;
}

export function PractitionerBookingAction({ employee, catalogServices, t, onNavigate }: Props) {
  const dir = useDir();
  const palette = useSawaaColors();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(palette, theme.colors), [palette, theme.colors]);
  const fontName = getFontName(dir.locale, '600');
  const bodyFont = getFontName(dir.locale, '400');
  const services = useMemo(() => getBookableServices(employee, catalogServices), [employee, catalogServices]);
  const [showServices, setShowServices] = useState(false);

  const selectService = (service: PublicService) => {
    setShowServices(false);
    onNavigate(practitionerBookingRoute(employee.id, service.id));
  };

  if (!employee.isBookable || services.length === 0) {
    return <Text style={[styles.empty, { fontFamily: bodyFont, textAlign: dir.textAlign }]}>{t('therapists.noBookableServices')}</Text>;
  }

  if (services.length === 1) {
    return (
      <Pressable accessibilityRole="button" style={styles.action} onPress={() => selectService(services[0])}>
        <Text style={[styles.actionText, { fontFamily: fontName }]}>{t('therapists.bookingService', { service: dir.isRTL ? services[0].nameAr : services[0].nameEn ?? services[0].nameAr })}</Text>
      </Pressable>
    );
  }

  return (
    <View>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: showServices }} style={styles.action} onPress={() => setShowServices((visible) => !visible)}>
        <Text style={[styles.actionText, { fontFamily: fontName }]}>{t('therapists.bookingServiceTitle')}</Text>
      </Pressable>
      <Modal visible={showServices} transparent animationType="fade" onRequestClose={() => setShowServices(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.options}>
            <ScrollView style={styles.serviceList}>
              {services.map((service) => (
                <Pressable key={service.id} accessibilityRole="button" style={styles.option} onPress={() => selectService(service)}>
                  <Text style={[styles.optionText, { fontFamily: fontName }]}>{dir.isRTL ? service.nameAr : service.nameEn ?? service.nameAr}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable accessibilityRole="button" onPress={() => setShowServices(false)} style={styles.cancel}>
              <Text style={[styles.cancelText, { fontFamily: fontName }]}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (sawaaColors: ReturnType<typeof useSawaaColors>, colors: ReturnType<typeof useTheme>['theme']['colors']) => StyleSheet.create({
  action: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: sawaaSpacing.lg, borderRadius: sawaaRadius.md, backgroundColor: colors.primaryFill },
  actionText: { color: colors.primaryForeground, fontSize: sawaaType.body.fontSize, fontWeight: '600' },
  empty: { color: sawaaColors.ink[500], fontSize: sawaaType.body.fontSize, textAlign: 'center' },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: sawaaSpacing.lg, backgroundColor: sawaaColors.glass.darkBg },
  options: { gap: sawaaSpacing.sm, padding: sawaaSpacing.md, borderRadius: sawaaRadius.lg, backgroundColor: sawaaColors.glass.opaqueBg },
  serviceList: { maxHeight: 360 },
  cancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: sawaaSpacing.md },
  cancelText: { color: sawaaColors.ink[700], fontSize: sawaaType.body.fontSize },
  option: { minHeight: 44, justifyContent: 'center', paddingHorizontal: sawaaSpacing.md, borderRadius: sawaaRadius.md, backgroundColor: sawaaColors.glass.bgStrong },
  optionText: { color: sawaaColors.ink[900], fontSize: sawaaType.body.fontSize },
});
