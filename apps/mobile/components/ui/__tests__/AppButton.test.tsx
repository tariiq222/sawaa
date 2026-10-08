import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet, Text, View } from 'react-native';
import { getSawaaColors, getSawaaRoles } from '@/theme/sawaa/tokens';
import { AppButton } from '../AppButton';
import { PrimaryButton } from '@/theme/sawaa/PrimaryButton';
import { SecondaryButton } from '../SecondaryButton';
import { ThemedButton } from '@/theme/components/ThemedButton';
import { OutlineButton } from '@/components/features/employee/OutlineButton';
let mockScheme: 'light' | 'dark' = 'light';
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: mockScheme }) }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: require('react-native').View }));

it('blocks action while busy, then enables it when ready', () => {
  const onPress = jest.fn();
  const view = render(<AppButton label="Continue" loading onPress={onPress} />);
  const button = view.getByRole('button', { name: 'Continue' });
  expect(button).toBeDisabled();
  expect(button.props.accessibilityState.busy).toBe(true);
  fireEvent.press(button);
  expect(onPress).not.toHaveBeenCalled();
  view.rerender(<AppButton label="Continue" onPress={onPress} />);
  fireEvent.press(view.getByRole('button', { name: 'Continue' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});
it('marks an action without a handler disabled', () => {
  const view = render(<AppButton label="Unavailable" />);
  expect(view.getByRole('button', { name: 'Unavailable' })).toBeDisabled();
});
it('retains an accessible label for a custom label node', () => {
  const view = render(<AppButton label={<Text>Custom</Text>} accessibilityLabel="Continue booking" onPress={jest.fn()} />);
  expect(view.getByRole('button', { name: 'Continue booking' })).toBeTruthy();
});
it.each(['primary', 'secondary', 'themed', 'outline'])('blocks a busy %s compatibility wrapper', kind => {
  const onPress = jest.fn();
  const components = {
    primary: <PrimaryButton label="Continue" loading onPress={onPress} />,
    secondary: <SecondaryButton label="Continue" loading onPress={onPress} />,
    themed: <ThemedButton loading onPress={onPress}>Continue</ThemedButton>,
    outline: <OutlineButton label="Continue" loading onPress={onPress} />,
  };
  const view = render(components[kind as keyof typeof components]);
  const button = view.getByRole('button', { name: 'Continue' });
  fireEvent.press(button);
  expect(onPress).not.toHaveBeenCalled();
  expect(button.props.accessibilityState.busy).toBe(true);
});
it('preserves the caller font on a primary label', () => {
  const view = render(<PrimaryButton label="Custom font" fontFamily="CallerFont" onPress={jest.fn()} />);
  expect(view.getByText('Custom font')).toHaveStyle({ fontFamily: 'CallerFont' });
});

// Compute actual rendered label/gradient/sheen against destination surfaces.
// These are contrast invariants, not assertions of particular style values.
function rgb(color: string): number[] {
  if (color.startsWith('#')) return color.slice(1, 7).match(/../g)!.map(channel => parseInt(channel, 16));
  return color.match(/[\d.]+/g)!.slice(0, 3).map(Number);
}
function blend(top: number[], alpha: number, bottom: number[]): number[] {
  return top.map((channel, index) => channel * alpha + bottom[index] * (1 - alpha));
}
function luminance(channels: number[]): number {
  return channels.map(channel => channel / 255).map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);
}
it.each([['light', false], ['light', true], ['dark', false], ['dark', true]] as const)(
  'keeps enabled primary contrast readable (%s, pressed=%s)', (scheme, pressed) => {
  mockScheme = scheme;
  const view = render(<AppButton label="Readable" onPress={jest.fn()} />);
  const control = view.UNSAFE_root.findAll((node: { props: { style?: unknown } }) => typeof node.props.style === 'function')[0];
  const opacity = StyleSheet.flatten(control.props.style({ pressed })).opacity ?? 1;
  const foreground = rgb(StyleSheet.flatten(view.getByText('Readable').props.style).color);
  const gradient = view.UNSAFE_getAllByType(View).find(node => Array.isArray(node.props.colors))!;
  const sheen = view.UNSAFE_getAllByType(View).find(node => node.props.pointerEvents === 'none')!;
  const sheenColor = StyleSheet.flatten(sheen.props.style).backgroundColor;
  const sheenAlpha = Number(sheenColor.match(/[\d.]+/g)![3]);
  const roles = getSawaaRoles(scheme);
  for (const destination of [roles.background, roles.surface]) {
    const backdrop = rgb(destination);
    for (const endpoint of gradient.props.colors as string[]) {
      const fillWithSheen = blend(rgb(sheenColor), sheenAlpha, rgb(endpoint));
      const visibleFill = blend(fillWithSheen, opacity, backdrop);
      const visibleText = blend(foreground, opacity, backdrop);
      const a = luminance(visibleFill), b = luminance(visibleText);
      expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
  }
});

// Darkest actual light Aqua pixel is RGB(49,151,175) at (852,1).
// Its existing white bgSoft wash is composed before foreground contrast.
it.each(['secondary', 'ghost'] as const)('keeps %s readable on the light Aqua backdrop', variant => {
  mockScheme = 'light';
  const view = render(<AppButton label="Readable on Aqua" variant={variant} onPress={jest.fn()} />);
  const foreground = rgb(StyleSheet.flatten(view.getByText('Readable on Aqua').props.style).color);
  const wash = getSawaaColors('light').glass.bgSoft;
  const backdrop = blend(rgb(wash), Number(wash.match(/[\d.]+/g)![3]), [49, 151, 175]);
  const a = luminance(foreground), b = luminance(backdrop);
  expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toBeGreaterThanOrEqual(4.5);
});
