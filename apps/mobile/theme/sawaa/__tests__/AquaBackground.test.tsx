import React from 'react';
import { render } from '@testing-library/react-native';
import { ImageBackground, StyleSheet, View } from 'react-native';
import { AquaBackground } from '../AquaBackground';
import { getSawaaColors, getSawaaRoles } from '../tokens';

let mockScheme = 'light';
jest.mock('../../useTheme', () => ({ useTheme: () => ({ scheme: mockScheme }) }));

describe('AquaBackground appearance', () => {
  it('softens the light asset while keeping the dark asset free of a wash', () => {
    mockScheme = 'light';
    const screen = render(<AquaBackground testID="background" />);
    expect(screen.UNSAFE_getByType(ImageBackground).props.source).toEqual(
      require('../../../assets/bg-aqua.png'),
    );
    expect(StyleSheet.flatten(screen.getByTestId('background').props.style).backgroundColor)
      .toBe(getSawaaRoles('light').backdrop.base);
    expect(screen.UNSAFE_getAllByType(View).some(view =>
      StyleSheet.flatten(view.props.style)?.backgroundColor === getSawaaColors('light').glass.bgSoft,
    )).toBe(true);

    mockScheme = 'dark';
    screen.rerender(<AquaBackground testID="background" />);
    expect(screen.UNSAFE_getByType(ImageBackground).props.source).toEqual(
      require('../../../assets/bg-aqua-dark.png'),
    );
    expect(screen.UNSAFE_getAllByType(ImageBackground).length).toBe(1);
    expect(screen.UNSAFE_getAllByType(View).some(view =>
      StyleSheet.flatten(view.props.style)?.backgroundColor === getSawaaRoles('dark').backdrop.wash,
    )).toBe(false);
  });
  it('forces the dark asset when variant is dark in light appearance', () => {
    mockScheme = 'light';
    const screen = render(<AquaBackground variant="dark" testID="background" />);
    expect(screen.UNSAFE_getByType(ImageBackground).props.source).toEqual(
      require('../../../assets/bg-aqua-dark.png'),
    );
    expect(StyleSheet.flatten(screen.getByTestId('background').props.style).backgroundColor)
      .toBe(getSawaaRoles('dark').backdrop.base);
  });
});
