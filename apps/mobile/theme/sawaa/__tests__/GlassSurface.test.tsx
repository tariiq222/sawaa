import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
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

describe('GlassSurface shared renderer', () => {
  it('defaults to an opaque content surface while preserving the bottom-dock glass opt-in', () => {
    mockGlassApiAvailable = true;
    const content = render(<GlassSurface testID="content" />);
    expect(StyleSheet.flatten(content.getByTestId('content').props.style).backgroundColor).toBe('#F7F9FB');
    expect(content.queryByTestId('native-glass')).toBeNull();
    const dock = render(<GlassSurface material="glass" testID="dock" />);
    expect(dock.getByTestId('native-glass')).toBeTruthy();
  });
  beforeEach(() => {
    mockReduceTransparency = false;
    mockIncreasedContrast = false;
    mockGlassApiAvailable = true;
    mockScheme = 'light';
    mockReduceMotion = false;
  });

  it('uses an opaque theme surface and avoids native glass when transparency is reduced', () => {
    mockReduceTransparency = true;
    mockIncreasedContrast = true;
    mockScheme = 'light';
    const { queryByTestId, getByTestId } = render(<GlassSurface material="glass" testID="surface" />);
    const surface = getByTestId('surface');
    const style = StyleSheet.flatten(surface.props.style);

    expect(queryByTestId('native-glass')).toBeNull();
    expect(style.backgroundColor).toBe('#F7F9FB');
    expect(style.borderWidth).toBeGreaterThanOrEqual(2);
  });

  it('keeps the reduced-transparency surface opaque over a translucent caller style', () => {
    mockReduceTransparency = true;
    mockIncreasedContrast = false;
    mockScheme = 'light';
    const { getByTestId } = render(
      <GlassSurface testID="surface" style={{ backgroundColor: 'rgba(255, 255, 255, 0.18)' }} />,
    );

    expect(StyleSheet.flatten(getByTestId('surface').props.style).backgroundColor).toBe('#F7F9FB');
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
    const { getByTestId } = render(<GlassSurface material="glass" testID="surface" />);

    expect(getByTestId('native-glass')).toBeTruthy();
    expect(getByTestId('native-glass').props.colorScheme).toBe('light');
    expect(isGlassEffectAPIAvailable).toHaveBeenCalled();
    expect(isLiquidGlassAvailable).toHaveBeenCalled();
  });

  it('restores untinted native surfaces with the original variant borders', () => {
    mockReduceTransparency = false;
    mockIncreasedContrast = false;
    mockGlassApiAvailable = true;
    mockScheme = 'light';

    const regular = render(<Glass material="glass" variant="regular" testID="regular-glass" />);
    const clear = render(<Glass material="glass" variant="clear" testID="clear-glass" />);

    expect(regular.getByTestId('native-glass').props.tintColor).toBeUndefined();
    expect(clear.getByTestId('native-glass').props.tintColor).toBeUndefined();
    expect(regular.queryByTestId('fallback-gradient')).toBeNull();
    expect(StyleSheet.flatten(regular.getByTestId('regular-glass').props.style).borderColor)
      .toBe('rgba(255, 255, 255, 0.55)');
    expect(StyleSheet.flatten(clear.getByTestId('clear-glass').props.style).borderColor)
      .toBe('rgba(255, 255, 255, 0.35)');
  });

  it('falls back when the GlassEffect API is unavailable at runtime', () => {
    mockReduceTransparency = false;
    mockIncreasedContrast = false;
    mockGlassApiAvailable = false;
    const { queryByTestId, getByTestId } = render(<GlassSurface material="glass" testID="surface" />);

    expect(queryByTestId('native-glass')).toBeNull();
    expect(getByTestId('fallback-blur')).toBeTruthy();
  });

  it('uses dark fallback tint, fill, and highlights when the app scheme is dark', () => {
    mockReduceTransparency = false;
    mockIncreasedContrast = false;
    mockGlassApiAvailable = false;
    mockScheme = 'dark';
    const { getByTestId, UNSAFE_getAllByType } = render(<GlassSurface material="glass" variant="base" testID="surface" />);

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
    const { getByTestId } = render(<Glass material="glass"><Text>Dark glass</Text></Glass>);

    expect(getByTestId('fallback-blur').props.tint).toBe('dark');
    expect(getByTestId('fallback-blur').props.intensity).toBe(24);
  });

  it('lets Glass render a themed surface with the GlassSurface props', () => {
    mockReduceTransparency = true;
    mockIncreasedContrast = false;
    mockScheme = 'dark';
    const { getByTestId, getByText, UNSAFE_getAllByType } = render(
      <Glass variant="base" padding={12} style={{ gap: 8, flexDirection: 'row' }} testID="unified-surface">
        <Text>Unified content</Text>
      </Glass>,
    );

    expect(getByTestId('unified-surface')).toBeTruthy();
    expect(getByText('Unified content')).toBeTruthy();
    expect(UNSAFE_getAllByType(View).some((view) => StyleSheet.flatten(view.props.style)?.padding === 12)).toBe(true);
    expect(UNSAFE_getAllByType(View).some((view) => {
      const contentStyle = StyleSheet.flatten(view.props.style);
      return contentStyle?.gap === 8 && contentStyle.flexDirection === 'row';
    })).toBe(true);
  });

  it('keeps native interactivity and maps soft to the clear glass treatment', () => {
    mockReduceTransparency = false;
    mockIncreasedContrast = false;
    mockGlassApiAvailable = true;
    mockScheme = 'light';
    const { getByTestId } = render(<Glass material="glass" variant="soft" interactive onPress={() => {}} testID="soft-action" />);

    expect(getByTestId('native-glass').props.glassEffectStyle).toBe('clear');
    expect(getByTestId('native-glass').props.isInteractive).toBe(true);
  });

  it('does not animate the pressed scale when Reduce Motion is enabled', () => {
    mockReduceTransparency = false;
    mockIncreasedContrast = false;
    mockReduceMotion = true;
    mockGlassApiAvailable = false;
    const { getByTestId } = render(<Glass interactive onPress={() => {}} testID="motion-safe-action" />);

    fireEvent(getByTestId('motion-safe-action'), 'pressIn');

    expect(StyleSheet.flatten(getByTestId('motion-safe-action').props.style)?.transform).toBeUndefined();
  });

  it('preserves existing Glass actions and disabled behavior through GlassSurface', () => {
    const onPress = jest.fn();
    const { getByRole, getByText, rerender } = render(
      <Glass accessibilityRole="button" accessibilityLabel="Back" onPress={onPress}
        radius={22} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Back</Text>
      </Glass>,
    );

    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(getByText('Back')).toBeTruthy();

    rerender(<GlassSurface accessibilityRole="button" accessibilityLabel="Back" onPress={onPress} disabled />);
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
