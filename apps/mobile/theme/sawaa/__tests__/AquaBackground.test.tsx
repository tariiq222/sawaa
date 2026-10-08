import React from 'react';
import { render } from '@testing-library/react-native';
import { ImageBackground, StyleSheet, Text, View } from 'react-native';
import { AquaBackground } from '../AquaBackground';

let mockScheme = 'light';
let mockIsHydrated: boolean | undefined;
jest.mock('../../useTheme', () => ({ useTheme: () => ({ scheme: mockScheme, isHydrated: mockIsHydrated }) }));

describe('AquaBackground appearance', () => {
  beforeEach(() => { mockScheme = 'light'; mockIsHydrated = undefined; });

  it('restores the light wave image with a noninteractive readability wash', () => {
    const screen = render(<AquaBackground><Text>المحتوى</Text></AquaBackground>);
    const image = screen.UNSAFE_getByType(ImageBackground);
    expect(image.props.source).toEqual(require('../../../assets/bg-aqua.png'));
    expect(image.props.resizeMode).toBe('cover');
    expect(StyleSheet.flatten(image.props.style)).toMatchObject({
      position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    });
    expect(image.parent?.props.pointerEvents).toBe('none');
    const wash = screen.UNSAFE_getAllByType(View).find((view) =>
      StyleSheet.flatten(view.props.style)?.backgroundColor === 'rgba(255, 255, 255, 0.18)',
    );
    expect(wash).toBeDefined();
    expect(wash?.props.pointerEvents).toBe('none');
    expect(screen.getByText('المحتوى')).toBeTruthy();
  });

  it('switches to the dark wave image without the light wash when the theme changes', () => {
    const screen = render(<AquaBackground />);
    mockScheme = 'dark';
    screen.rerender(<AquaBackground />);
    expect(screen.UNSAFE_getByType(ImageBackground).props.source)
      .toEqual(require('../../../assets/bg-aqua-dark.png'));
    expect(screen.UNSAFE_getAllByType(View).some((view) =>
      StyleSheet.flatten(view.props.style)?.backgroundColor === 'rgba(255, 255, 255, 0.18)',
    )).toBe(false);
  });

  it.each(['aqua', 'dark'] as const)('defers %s decoration until hydration while keeping content visible', variant => {
    mockIsHydrated = false;
    const screen = render(<AquaBackground variant={variant}><Text>المحتوى</Text></AquaBackground>);
    expect(screen.UNSAFE_queryByType(ImageBackground)).toBeNull();
    expect(screen.UNSAFE_getAllByType(View).some(view =>
      StyleSheet.flatten(view.props.style)?.backgroundColor === 'rgba(255, 255, 255, 0.18)',
    )).toBe(false);
    expect(screen.getByText('المحتوى')).toBeTruthy();
    mockScheme = 'dark';
    mockIsHydrated = true;
    screen.rerender(<AquaBackground variant={variant}><Text>المحتوى</Text></AquaBackground>);
    expect(screen.UNSAFE_getByType(ImageBackground).props.source).toEqual(require('../../../assets/bg-aqua-dark.png'));
    expect(screen.getByText('المحتوى')).toBeTruthy();
  });

  it('honors an explicit dark appearance while the system theme is light', () => {
    const screen = render(<AquaBackground variant="dark" />);
    expect(screen.UNSAFE_getByType(ImageBackground).props.source)
      .toEqual(require('../../../assets/bg-aqua-dark.png'));
    expect(screen.UNSAFE_getAllByType(View).some((view) =>
      StyleSheet.flatten(view.props.style)?.backgroundColor === 'rgba(255, 255, 255, 0.18)',
    )).toBe(false);
  });
});
