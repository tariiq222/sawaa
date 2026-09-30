import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, User } from 'lucide-react-native';

import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { getSawaaRoles, sawaaRadius, sawaaType } from '@/theme/sawaa/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { Glass } from '@/theme/components/Glass';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { getFontName } from '@/theme/fonts';
import { useDir } from '@/hooks/useDir';
import { useTranslation } from 'react-i18next';

interface HomeTopBarProps {
  f600: string;
  isClient?: boolean;
  /** Client only: short date line above the greeting. */
  dateLabel?: string;
  /** Client only: greeting line, e.g. "مساء الخير، أمل". */
  greeting?: string;
}

function NotificationButton() {
  const colors = useSawaaColors();
  const { scheme } = useTheme();
  const action = getSawaaRoles(scheme).action;
  const styles = React.useMemo(() => createStyles(colors, action), [colors, action]);
  const router = useRouter();
  const dir = useDir();
  const { t } = useTranslation();
  const { count: unreadCount } = useUnreadCount();
  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);
  return (
    <Glass variant="regular" radius={sawaaRadius.pill} style={styles.iconBtn}>
      <Pressable onPress={() => router.push('/(client)/notifications')} style={styles.iconBtnInner}
        accessibilityRole="button" accessibilityLabel={t('nav.notifications')}>
        <Bell size={22} color={colors.teal[700]} strokeWidth={1.75} />
        {unreadCount > 0 ? (
          <View style={[styles.bellBadge, badgeLabel.length > 2 ? styles.bellBadgeWide : null]}>
            <Text style={[styles.bellBadgeText, { fontFamily: getFontName(dir.locale, '700') }]}>{badgeLabel}</Text>
          </View>
        ) : null}
      </Pressable>
    </Glass>
  );
}

/**
 * Home header. Clients see date + greeting with the notification bell; guests see the
 * centre logo and name with a sign-in button. Search lives in the Explore tab.
 */
export function HomeTopBar({ f600, isClient = true, dateLabel, greeting }: HomeTopBarProps) {
  const colors = useSawaaColors();
  const { scheme } = useTheme();
  const action = getSawaaRoles(scheme).action;
  const styles = React.useMemo(() => createStyles(colors, action), [colors, action]);
  const router = useRouter();
  const dir = useDir();
  const { t } = useTranslation();
  const f700 = getFontName(dir.locale, '700');

  if (isClient) {
    return (
      <View style={[styles.topBar, { flexDirection: dir.row }]}>
        <View style={styles.textBlock}>
          {dateLabel ? (
            <Text style={[styles.date, { fontFamily: f600, color: colors.ink[500], textAlign: dir.textAlign }]}>{dateLabel}</Text>
          ) : null}
          <Text accessibilityRole="header" numberOfLines={2}
            style={[styles.greeting, { fontFamily: f700, color: colors.ink[900], textAlign: dir.textAlign }]}>{greeting}</Text>
        </View>
        <NotificationButton />
      </View>
    );
  }

  return (
    <View style={[styles.topBar, { flexDirection: dir.row }]}>
      <View style={[styles.brand, { flexDirection: dir.row }]}>
        <Image source={require('@/assets/sawa/logo.png')} resizeMode="contain" accessible={false} style={styles.brandLogo} />
        <Text accessibilityRole="header" numberOfLines={2}
          style={[styles.brandName, { fontFamily: f700, color: colors.ink[900], textAlign: dir.textAlign }]}>{t('home.brandTitle')}</Text>
      </View>
      <Glass variant="regular" radius={sawaaRadius.pill} style={styles.iconBtn}>
        <Pressable onPress={() => router.push('/(auth)/login')} style={styles.iconBtnInner}
          accessibilityRole="button" accessibilityLabel={t('auth.login')}>
          <User size={22} color={colors.teal[700]} strokeWidth={1.75} />
        </Pressable>
      </Glass>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>, action: ReturnType<typeof getSawaaRoles>['action']) => StyleSheet.create({
  topBar: { alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  textBlock: { flex: 1 },
  date: { fontSize: sawaaType.body.fontSize },
  greeting: { fontSize: 28, lineHeight: 38 },
  brand: { flex: 1, alignItems: 'center', gap: 10 },
  brandLogo: { width: 44, height: 52 },
  brandName: { flex: 1, fontSize: 17, lineHeight: 24 },
  iconBtn: { width: 48, height: 48 },
  iconBtnInner: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  bellBadge: {
    position: 'absolute',
    top: 6,
    right: 4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: action.fill,
    borderWidth: 1.5,
    borderColor: colors.glass.opaqueBg,
  },
  bellBadgeWide: { minWidth: 22, paddingHorizontal: 5 },
  bellBadgeText: { fontSize: 10, lineHeight: 12, color: action.foreground, textAlign: 'center' },
});
