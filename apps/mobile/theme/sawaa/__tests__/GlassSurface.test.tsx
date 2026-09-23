import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet, Text, View } from 'react-native';
import { GlassSurface } from '../GlassSurface';
import { Glass } from '../../components/Glass';
import { isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';

let mockReduceTransparency = true;
let mockIncreasedContrast = true;
let mockGlassApiAvailable = true;
let mockScheme = 'light';
let mockReduceMotion = false;

jest.mock('../../../hooks/useA11y', () => ({
  useReducedTransparency: () => mockReduceTransparency,
  useIncreasedContrast: () => mockIncreasedContrast,
  useReduceMotion: () => mockReduceMotion,
}));

jest.mock('../../../theme/useTheme', () => ({
  useTheme: () => ({
    scheme: mockScheme,
    theme: {
      colors: {
        surface: mockScheme === 'dark' ? '#0c2424' : '#F7F9FB',
        textPrimary: mockScheme === 'dark' ? '#e8f4f2' : '#191C1E',
      },
    },
  }),
}));

jest.mock('expo-glass-effect', () => {
  const ReactModule = require('react');
  const Native = require('react-native');
  return {
    GlassView: (props: object) => ReactModule.createElement(Native.View, { ...props, testID: 'native-glass' }),
    isGlassEffectAPIAvailable: jest.fn(() => mockGlassApiAvailable),
    isLiquidGlassAvailable: jest.fn(() => true),
  };
});

jest.mock('expo-blur', () => ({
  BlurView: (props: object) => {
    const ReactModule = require('react');
    const Native = require('react-native');
    return ReactModule.createElement(Native.View, { ...props, testID: 'fallback-blur' });
  },
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: (props: object) => {
    const ReactModule = require('react');
    const Native = require('react-native');
    return ReactModule.createElement(Native.View, { ...props, testID: 'fallback-gradient' });
  },
}));

describe('GlassSurface accessibility fallback', () => {
  it('uses an opaque theme surface and avoids native glass when transparency is reduced', () => {
    mockReduceTransparency = true;
    mockIncreasedContrast = true;
    mockScheme = 'light';
    const { queryByTestId, getByTestId } = render(<GlassSurface testID="surface" />);
    const surface = getByTestId('surface');
    const style = StyleSheet.flatten(surface.props.style);

    expect(queryByTestId('native-glass')).toBeNull();
    expect(style.backgroundColor).toBe('#F7F9FB');
    expect(style.borderWidth).toBeGreaterThanOrEqual(2);
  });

  it('keeps an explicit dark surface opaque with a light contrast border', () => {
    mockReduceTransparency = true;
    mockIncreasedContrast = true;
    mockScheme = 'light';
    const { getByTestId } = render(<GlassSurface variant="dark" testID="surface" />);
    const style = StyleSheet.flatten(getByTestId('surface').props.style);

    expect(style.backgroundColor).toBe('#0c2424');
    expect(style.borderColor).toBe('#FFFFFF');
  });

  it('keeps the legacy Glass component opaque when transparency is reduced', () => {
    mockReduceTransparency = true;
    mockIncreasedContrast = true;
    mockScheme = 'dark';
    const { queryByTestId, toJSON } = render(<Glass><Text>Accessible content</Text></Glass>);
    const tree = toJSON();
    const style = StyleSheet.flatten(tree?.props.style);

    expect(queryByTestId('native-glass')).toBeNull();
    expect(queryByTestId('fallback-blur')).toBeNull();
    expect(style.backgroundColor).toBe('#0c2424');
  });

  it('uses native glass only when both runtime availability checks pass', () => {
    mockReduceTransparency = false;
    mockIncreasedContrast = false;
    mockGlassApiAvailable = true;
    mockScheme = 'light';
    const { getByTestId } = render(<GlassSurface testID="surface" />);

    expect(getByTestId('native-glass')).toBeTruthy();
    expect(getByTestId('native-glass').props.colorScheme).toBe('light');
    expect(isGlassEffectAPIAvailable).toHaveBeenCalled();
    expect(isLiquidGlassAvailable).toHaveBeenCalled();
  });

  it('falls back when the GlassEffect API is unavailable at runtime', () => {
    mockReduceTransparency = false;
    mockIncreasedContrast = false;
    mockGlassApiAvailable = false;
    const { queryByTestId, getByTestId } = render(<GlassSurface testID="surface" />);

    expect(queryByTestId('native-glass')).toBeNull();
    expect(getByTestId('fallback-blur')).toBeTruthy();
  });

  it('uses dark fallback tint, fill, and highlights when the app scheme is dark', () => {
    mockReduceTransparency = false;
    mockIncreasedContrast = false;
    mockGlassApiAvailable = false;
    mockScheme = 'dark';
    const { getByTestId, UNSAFE_getAllByType } = render(<GlassSurface variant="base" testID="surface" />);

    expect(getByTestId('fallback-blur').props.tint).toBe('dark');
    const darkFill = UNSAFE_getAllByType(View).some((view) =>
      StyleSheet.flatten(view.props.style)?.backgroundColor === 'rgba(12, 36, 36, 0.55)',
    );
    expect(darkFill).toBe(true);
    expect(getByTestId('fallback-gradient').props.colors).toEqual([
      'rgba(255,255,255,0.22)',
      'rgba(255,255,255,0.05)',
      'rgba(255,255,255,0)',
      'rgba(255,255,255,0.10)',
    ]);
  });

  it('uses the dark app scheme in the legacy Glass fallback', () => {
    mockReduceTransparency = false;
    mockIncreasedContrast = false;
    mockGlassApiAvailable = false;
    mockScheme = 'dark';
    const { getByTestId } = render(<Glass><Text>Dark glass</Text></Glass>);

    expect(getByTestId('fallback-blur').props.tint).toBe('dark');
    expect(StyleSheet.flatten(getByTestId('fallback-blur').props.style).backgroundColor)
      .toBe('rgba(12, 36, 36, 0.55)');
  });
});
