jest.mock('../../useTheme', () => ({ useTheme: () => ({ scheme: 'light' }) }));

import React from 'react';
import { I18nManager, Platform, StyleSheet, Text, View } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { AquaBackground } from '../AquaBackground';
import { buildDirState } from '@/hooks/useDir';

it.each([
  ['ios', false], ['ios', true], ['android', false], ['android', true], ['web', false], ['web', true],
] as const)('keeps physical alignment stable on %s when native RTL is %s', (platform, nativeRTL) => {
  const original = I18nManager.isRTL;
  const originalOS = Object.getOwnPropertyDescriptor(Platform, 'OS')!;
  Object.defineProperty(Platform, 'OS', { configurable: true, value: platform });
  I18nManager.isRTL = nativeRTL;
  try {
    render(<AquaBackground><Text>العربية</Text></AquaBackground>);
    const directions = screen.UNSAFE_getAllByType(View)
      .map((view) => StyleSheet.flatten(view.props.style)?.direction)
      .filter(Boolean);
    expect(directions).toEqual(['ltr']);
    expect(buildDirState('ar')).toMatchObject({ row: 'row-reverse', textAlign: 'right', writingDirection: 'rtl' });
    expect(buildDirState('en')).toMatchObject({ row: 'row', textAlign: 'left', writingDirection: 'ltr' });
  } finally {
    I18nManager.isRTL = original;
    Object.defineProperty(Platform, 'OS', originalOS);
  }
});
