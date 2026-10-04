import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

const mockBuildTheme = (scheme: 'light' | 'dark') =>
  require('@/theme/tokens').buildTheme(undefined, scheme);

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({ theme: mockBuildTheme('light'), scheme: 'light', isRTL: true, language: 'ar' }),
}));

import { GlassSwitch } from '../GlassSwitch';

describe('GlassSwitch', () => {
  it('reports the new value once', () => {
    const onValueChange = jest.fn();
    const screen = render(<GlassSwitch value={false} onValueChange={onValueChange} />);
    fireEvent(screen.getByRole('switch'), 'valueChange', true);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  // React Native maps the cross-platform props onto the native control:
  // trackColor.true -> onTintColor, trackColor.false -> tintColor, thumbColor -> thumbTintColor.
  it('takes every colour from the switch role, not ad-hoc values', () => {
    const light = mockBuildTheme('light').colors.switch;
    const control = render(<GlassSwitch value={false} onValueChange={jest.fn()} />).getByRole('switch');
    expect(control.props.onTintColor).toBe(light.trackOn);
    expect(control.props.tintColor).toBe(light.trackOff);
    expect(control.props.thumbTintColor).toBe(light.thumbOff);
  });

  it('uses the on-thumb colour once the switch is on', () => {
    const light = mockBuildTheme('light').colors.switch;
    const control = render(<GlassSwitch value onValueChange={jest.fn()} />).getByRole('switch');
    expect(control.props.thumbTintColor).toBe(light.thumbOn);
  });

  it('passes the disabled state and label through to the native control', () => {
    const screen = render(
      <GlassSwitch value={false} onValueChange={jest.fn()} disabled accessibilityLabel="الإشعارات" />,
    );
    const control = screen.getByRole('switch');
    expect(control.props.disabled).toBe(true);
    expect(control.props.accessibilityLabel).toBe('الإشعارات');
  });
});
