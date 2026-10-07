import React, { Component, type ReactNode, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import i18n from '@/i18n';
import { buildTheme } from '@/theme/tokens';
import { getFontName } from '@/theme/fonts';
import { THEME_MODE_KEY, type ThemeMode } from '@/theme/preferences';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  language?: 'ar' | 'en';
}
interface State { hasError: boolean; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(): State { return { hasError: true }; }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
  }
  private handleRetry = () => { this.setState({ hasError: false }); };
  render() {
    if (!this.state.hasError) return this.props.children;
    return this.props.fallback ?? <ErrorFallback language={this.props.language ?? 'ar'} onRetry={this.handleRetry} />;
  }
}

/** Must work even when ThemeProvider, DirContext or another app provider fails. */
function ErrorFallback({ language, onRetry }: { language: 'ar' | 'en'; onRetry: () => void }) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('system');
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(THEME_MODE_KEY).then((value) => {
      if (active && (value === 'light' || value === 'dark' || value === 'system')) setMode(value);
    }).catch(() => { /* Current system appearance remains available without storage. */ });
    return () => { active = false; };
  }, []);
  const scheme = mode === 'system' ? systemScheme === 'dark' ? 'dark' : 'light' : mode;
  const theme = buildTheme(null, scheme);
  const styles = createStyles(theme.colors);
  const direction = language === 'ar' ? 'rtl' : 'ltr';
  const textStyle = { writingDirection: direction, fontFamily: getFontName(language) } as const;
  const translate = (key: string) => i18n.t(key, { lng: language });
  return (
    <View testID="app-error-fallback" style={styles.container}>
      <Text accessibilityRole="header" style={[styles.title, textStyle, { fontFamily: getFontName(language, '600') }]}>{translate('common.error')}</Text>
      <Text style={[styles.message, textStyle]}>{translate('common.errorDescription')}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={translate('common.tryAgain')} style={styles.button} onPress={onRetry}>
        <Text style={[styles.buttonText, textStyle, { fontFamily: getFontName(language, '600') }]}>{translate('common.tryAgain')}</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof buildTheme>['colors']) => StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: colors.background },
  title: { fontSize: 20, fontWeight: '600', color: colors.textPrimary, marginBottom: 8, textAlign: 'center' },
  message: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 24 },
  button: { minHeight: 44, justifyContent: 'center', backgroundColor: colors.primaryFill, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  buttonText: { color: colors.primaryForeground, fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
