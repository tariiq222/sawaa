import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, Search } from 'lucide-react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { getSawaaRoles } from '@/theme/sawaa/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { Glass } from '@/theme/components/Glass';
import { useAppSelector } from '@/hooks/use-redux';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { getFontName } from '@/theme/fonts';
import { useDir } from '@/hooks/useDir';
import { useTranslation } from 'react-i18next';

interface HomeTopBarProps {
  f600: string;
  isClient?: boolean;
}

function NotificationButton() {
  const sawaaColors = useSawaaColors();
  const { scheme } = useTheme();
  const action = getSawaaRoles(scheme).action;
  const styles = React.useMemo(() => createStyles(sawaaColors, action), [sawaaColors, action]);
  const router = useRouter();
  const dir = useDir();
  const { t } = useTranslation();
  const fBadge = getFontName(dir.locale, '700');
  const { count: unreadCount } = useUnreadCount();
  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);
  return (
    <Glass variant="regular" radius={21} style={styles.iconBtn}>
      <Pressable onPress={() => router.push('/(client)/notifications')} style={styles.iconBtnInner}
        accessibilityRole="button" accessibilityLabel={t('nav.notifications')}>
        <AppIcon sf="bell.fill" fallback={Bell} size={19} color={sawaaColors.teal[700]} strokeWidth={1.75} />
        {unreadCount > 0 ? (
          <View style={[styles.bellBadge, badgeLabel.length > 2 ? styles.bellBadgeWide : null]}>
            <Text style={[styles.bellBadgeText, { fontFamily: fBadge }]}>{badgeLabel}</Text>
          </View>
        ) : null}
      </Pressable>
    </Glass>
  );
}

export function HomeTopBar({ f600, isClient = true }: HomeTopBarProps) {
  const sawaaColors = useSawaaColors();
  const { scheme } = useTheme();
  const action = getSawaaRoles(scheme).action;
  const styles = React.useMemo(() => createStyles(sawaaColors, action), [sawaaColors, action]);
  const router = useRouter();
  const dir = useDir();
  const { t } = useTranslation();
  const user = useAppSelector((s) => s.auth.user);
  const initial = (user?.firstName ?? 'س').charAt(0);

  return (
    <View style={styles.topBar}>
      <View style={styles.topBarLeft}>
        <Glass variant="regular" radius={21} style={styles.iconBtn}>
          <Pressable
            onPress={() => router.push(isClient ? '/(client)/(tabs)/explore' : '/explore')}
            style={styles.iconBtnInner}
            accessibilityRole="button"
            accessibilityLabel={t('tabs.explore')}
          >
            <AppIcon sf="magnifyingglass" fallback={Search} size={19} color={sawaaColors.teal[700]} strokeWidth={1.75} />
          </Pressable>
        </Glass>
        {isClient ? <NotificationButton /> : null}
      {isClient ? (
        <Glass variant="regular" radius={21} style={styles.avatarBtn}>
          <Pressable onPress={() => router.push('/(client)/profile')} style={styles.avatarInner}
            accessibilityRole="button" accessibilityLabel={t('client.profile')}>
            <Text style={[styles.avatarText, { fontFamily: f600, fontWeight: '600' }]}>{initial}</Text>
          </Pressable>
        </Glass>
      ) : null}
      </View>
      {isClient ? (
        <View style={styles.brand}>
          <Image source={require('@/assets/sawa/logo.png')} resizeMode="contain" accessible={false}
            style={[styles.brandLogo, { tintColor: sawaaColors.teal[700] }]} />
          <Text style={[styles.brandName, { fontFamily: f600, color: sawaaColors.ink[900] }]}>{t('home.centerName')}</Text>
        </View>
      ) : (
        <View style={styles.guestBrand}>
          <Text numberOfLines={2} style={[styles.guestBrandText, {
            fontFamily: getFontName(dir.locale, '700'),
            color: sawaaColors.teal[900],
            textAlign: dir.textAlign,
          }]}>{t('home.brandTitle')}</Text>
          <Image source={require('@/assets/sawa/logo.png')} resizeMode="contain" accessible={false}
            style={[styles.guestBrandLogo, { tintColor: sawaaColors.teal[700] }]} />
        </View>
      )}
    </View>
  );
}

const createStyles = (sawaaColors: ReturnType<typeof useSawaaColors>, action: ReturnType<typeof getSawaaRoles>['action']) => StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  topBarLeft: { flexDirection: 'row', gap: 8 },
  brand: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  brandLogo: { width: 38, height: 46 },
  brandName: { fontSize: 16, lineHeight: 24 },
  iconBtn: { width: 42, height: 42 },
  iconBtnInner: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  avatarBtn: { width: 42, height: 42 },
  bellBadge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: action.fill,
    borderWidth: 1.5,
    borderColor: sawaaColors.glass.opaqueBg,
  },
  bellBadgeWide: {
    minWidth: 22,
    paddingHorizontal: 5,
  },
  bellBadgeText: {
    fontSize: 9.5,
    lineHeight: 12,
    color: action.foreground,
    textAlign: 'center',
  },
  avatarInner: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, color: sawaaColors.teal[700] },
  guestBrand: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  guestBrandText: { fontSize: 12, lineHeight: 17, flexShrink: 1 },
  guestBrandLogo: { width: 32, height: 38 },
});
