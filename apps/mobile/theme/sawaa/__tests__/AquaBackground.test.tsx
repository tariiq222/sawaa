import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';
import { AquaBackground } from '../AquaBackground';
import { getSawaaRoles } from '../tokens';

let mockScheme = 'light';
jest.mock('../../useTheme', () => ({ useTheme: () => ({ scheme: mockScheme }) }));

describe('AquaBackground appearance', () => {
  it('follows appearance changes without requiring a screen variant', () => {
    mockScheme = 'light';
    const screen = render(<AquaBackground testID="background" />);
    expect(StyleSheet.flatten(screen.getByTestId('background').props.style).backgroundColor)
      .toBe(getSawaaRoles('light').backdrop.base);
    mockScheme = 'dark';
    screen.rerender(<AquaBackground testID="background" />);
    expect(StyleSheet.flatten(screen.getByTestId('background').props.style).backgroundColor)
      .toBe(getSawaaRoles('dark').backdrop.base);
    expect(screen.UNSAFE_getAllByType(View).some(view =>
      StyleSheet.flatten(view.props.style)?.backgroundColor === getSawaaRoles('dark').backdrop.wash,
    )).toBe(true);
  });
  it('keeps an explicit immersive dark variant in light appearance', () => {
    mockScheme = 'light';
    const screen = render(<AquaBackground variant="dark" testID="background" />);
    expect(StyleSheet.flatten(screen.getByTestId('background').props.style).backgroundColor)
      .toBe(getSawaaRoles('dark').backdrop.base);
  });
});
