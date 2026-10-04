import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AquaBackground } from '@/theme/sawaa';
import { PrimaryButton } from '@/theme/sawaa/PrimaryButton';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { goBackOrHome } from '@/lib/navigation';

/**
 * Fallback for any URL that matches no route (an old deep link, a mistyped
 * push destination). Without it expo-router renders a dead end, so this screen
 * always offers one labelled way out: back when there is history, else home.
 */
export default function NotFoundScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const dir = useDir();
  const colors = useSawaaColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const f400 = getFontName(dir.locale, '400');
  const f700 = getFontName(dir.locale, '700');

  return (
    <AquaBackground>
      <View style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}>
        <Text
          style={[styles.title, { fontFamily: f700, textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}
        >
          {t('notFound.title')}
        </Text>
        <Text
          style={[styles.body, { fontFamily: f400, fontWeight: '400', textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}
        >
          {t('notFound.message')}
        </Text>
        <PrimaryButton
          label={t('notFound.back')}
          onPress={() => goBackOrHome(router)}
          style={styles.action}
        />
      </View>
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  title: { fontSize: 22, color: colors.ink[900] },
  body: { fontSize: 15, color: colors.ink[700], lineHeight: 24 },
  action: { alignSelf: 'stretch', marginTop: 8 },
});
