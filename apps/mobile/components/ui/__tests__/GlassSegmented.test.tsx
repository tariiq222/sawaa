import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    theme: require('@/theme/tokens').buildTheme(),
    scheme: 'light',
    isRTL: true,
    language: 'ar',
  }),
}));
jest.mock('@/hooks/useDir', () => ({
  useDir: () => ({ locale: 'ar', isRTL: true, row: 'row-reverse', textAlign: 'right' }),
}));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/components/Glass', () => ({ Glass: require('react-native').View }));

import { GlassSegmented } from '../GlassSegmented';

const OPTIONS = [
  { value: 'ar' as const, label: 'العربية' },
  { value: 'en' as const, label: 'English' },
];

describe('GlassSegmented', () => {
  it('presents every option as a tab of one control', () => {
    const screen = render(<GlassSegmented options={OPTIONS} value="ar" onChange={jest.fn()} />);
    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });

  it('marks only the active option as selected', () => {
    const screen = render(<GlassSegmented options={OPTIONS} value="ar" onChange={jest.fn()} />);
    const [arabic, english] = screen.getAllByRole('tab');
    expect(arabic.props.accessibilityState).toEqual({ selected: true });
    expect(english.props.accessibilityState).toEqual({ selected: false });
  });

  it('moves the selection when the value changes', () => {
    const screen = render(<GlassSegmented options={OPTIONS} value="en" onChange={jest.fn()} />);
    const [arabic, english] = screen.getAllByRole('tab');
    expect(arabic.props.accessibilityState).toEqual({ selected: false });
    expect(english.props.accessibilityState).toEqual({ selected: true });
  });

  it('reports a newly chosen option exactly once', () => {
    const onChange = jest.fn();
    const screen = render(<GlassSegmented options={OPTIONS} value="ar" onChange={onChange} />);
    fireEvent.press(screen.getByLabelText('English'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('en');
  });

  it('does not re-report the option already active', () => {
    const onChange = jest.fn();
    const screen = render(<GlassSegmented options={OPTIONS} value="ar" onChange={onChange} />);
    fireEvent.press(screen.getByLabelText('العربية'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders an optional count beside its option', () => {
    const screen = render(
      <GlassSegmented
        options={[
          { value: 'all' as const, label: 'الكل', badge: '3' },
          { value: 'unread' as const, label: 'غير المقروءة', badge: '0' },
        ]}
        value="all"
        onChange={jest.fn()}
      />,
    );
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('gives the appointments navigation style a light selected pill and branded text', () => {
    const screen = render(
      <GlassSegmented options={OPTIONS} value="ar" onChange={jest.fn()} appearance="navigation" />,
    );
    const selected = screen.getByRole('tab', { name: 'العربية' });
    const inactive = screen.getByRole('tab', { name: 'English' });
    const selectedStyle = StyleSheet.flatten(selected.props.style);
    const inactiveStyle = StyleSheet.flatten(inactive.props.style);
    const selectedText = screen.getByText('العربية');

    expect(selectedStyle.backgroundColor).not.toBe('#087a6f');
    expect(selectedStyle.backgroundColor).toMatch(/^#[0-9a-f]{8}$/i);
    expect(inactiveStyle.backgroundColor).toBeUndefined();
    expect(StyleSheet.flatten(selectedText.props.style).color).toBe('#066962');
  });
});
