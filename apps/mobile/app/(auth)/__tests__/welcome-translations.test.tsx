import React from 'react';
import { act, render } from '@testing-library/react-native';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: View,
    Circle: View,
    Defs: View,
    Path: View,
    RadialGradient: View,
    Stop: View,
  };
});
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const chain = () => {
    const builder: Record<string, unknown> = {};
    for (const method of ['delay', 'duration', 'easing']) builder[method] = () => builder;
    return builder;
  };
  return {
    __esModule: true,
    default: { View },
    FadeIn: chain(),
    FadeInDown: chain(),
    FadeInUp: chain(),
    ZoomIn: chain(),
    useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: (factory: () => unknown) => factory(),
    withDelay: (value: unknown) => value,
    withRepeat: (value: unknown) => value,
    withSequence: (value: unknown) => value,
    withTiming: (value: unknown) => value,
    Easing: { inOut: () => undefined, out: () => undefined, sin: undefined, cubic: undefined, bezier: () => undefined },
  };
});
jest.mock('@/theme/sawaa', () => {
  const actual = jest.requireActual('@/theme/sawaa');
  return { ...actual, AquaBackground: ({ children }: { children?: React.ReactNode }) => <>{children}</> };
});
jest.mock('@/theme/components/Glass', () => ({
  Glass: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        primaryForeground: '#FFFFFF',
        primaryGradient: ['#087a6f', '#066962'],
      },
    },
    scheme: 'light',
  }),
}));

import i18n from '@/i18n';
import WelcomeScreen from '../welcome';

describe('WelcomeScreen translations', () => {
  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('ar');
    });
  });

  it.each([
    ['ar', 'رحلتك للسواء تبدأ هنا', 'تسجيل دخول', 'تسجيل جديد'],
    ['en', 'Your journey to Sawaa starts here', 'Login', 'Create Account'],
  ])('renders the welcome copy in %s from the translation files', async (language, headline, signIn, signUp) => {
    await act(async () => {
      await i18n.changeLanguage(language as string);
    });
    const { getByText, getAllByText } = render(<WelcomeScreen />);

    expect(getByText(headline as string)).toBeTruthy();
    expect(getByText(signIn as string)).toBeTruthy();
    expect(getByText(signUp as string)).toBeTruthy();
    // Brand wordmark stays the Arabic brand name in both locales.
    expect(getAllByText('سَواء').length).toBe(1);
  });

  it('never falls back to Arabic copy in English', async () => {
    await act(async () => {
      await i18n.changeLanguage('en');
    });
    const { queryByText, getByText } = render(<WelcomeScreen />);

    expect(queryByText('رحلتك للسواء تبدأ هنا')).toBeNull();
    expect(queryByText('تسجيل دخول')).toBeNull();
    expect(queryByText('تسجيل جديد')).toBeNull();
    expect(getByText('Your journey to Sawaa starts here')).toBeTruthy();
  });

  it('resolves all five welcome keys in both locales', async () => {
    const keys = ['brand', 'headline', 'sub', 'signIn', 'signUp'];
    for (const language of ['ar', 'en']) {
      const fixed = i18n.getFixedT(language);
      for (const key of keys) {
        const value = fixed(`welcome.${key}`);
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
        expect(value).not.toBe(`welcome.${key}`);
      }
    }
  });

  it('makes no licensing or certification claim in the English welcome copy', async () => {
    const en = i18n.getFixedT('en');
    const copy = ['welcome.headline', 'welcome.sub', 'welcome.signIn', 'welcome.signUp']
      .map((key) => String(en(key)))
      .join(' ');
    expect(copy).not.toMatch(/licens|certifi|accredit|board[- ]certified/i);

    await act(async () => {
      await i18n.changeLanguage('en');
    });
    const { getByText } = render(<WelcomeScreen />);
    expect(getByText(String(en('welcome.sub')))).toBeTruthy();
  });
});
