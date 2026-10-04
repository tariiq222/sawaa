import React from 'react';
import { render } from '@testing-library/react-native';
import { ImageBackground, StyleSheet } from 'react-native';
import { AquaBackground } from '../AquaBackground';
import { getSawaaRoles } from '../tokens';

let mockScheme = 'light';
jest.mock('../../useTheme', () => ({ useTheme: () => ({ scheme: mockScheme }) }));

describe('AquaBackground appearance', () => {
  it('uses a quiet opaque canvas in light and dark modes', () => {
    mockScheme = 'light';
    const screen = render(<AquaBackground testID="background" />);
    expect(StyleSheet.flatten(screen.getByTestId('background').props.style).backgroundColor)
      .toBe(getSawaaRoles('light').background);
    expect(screen.UNSAFE_queryByType(ImageBackground)).toBeNull();

    mockScheme = 'dark';
    screen.rerender(<AquaBackground testID="background" />);
    expect(StyleSheet.flatten(screen.getByTestId('background').props.style).backgroundColor)
      .toBe(getSawaaRoles('dark').background);
  });

  it('honors the explicit dark appearance', () => {
    mockScheme = 'light';
    const screen = render(<AquaBackground variant="dark" testID="background" />);
    expect(StyleSheet.flatten(screen.getByTestId('background').props.style).backgroundColor)
      .toBe(getSawaaRoles('dark').background);
  });
});
