import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { DirContext, buildDirState } from '@/hooks/useDir';
import { PrimaryButton } from '../sawaa/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { OutlineButton } from '@/components/features/employee/OutlineButton';

jest.mock('../useTheme', () => ({ useTheme: () => ({ scheme: 'light' }) }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: require('react-native').View }));

it.each([PrimaryButton, SecondaryButton, OutlineButton])('blocks presses while loading and exposes busy state', (Button) => {
  const onPress = jest.fn();
  const screen = render(<Button label="Save" loading onPress={onPress} />);
  const button = screen.getByRole('button', { name: 'Save' });
  expect(button.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  fireEvent.press(button);
  expect(onPress).not.toHaveBeenCalled();
});

it('prevents a second press until an async primary action completes', async () => {
  let finish: (() => void) | undefined;
  const onPress = jest.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
  const screen = render(<PrimaryButton label="Save" onPress={onPress} />);
  const button = screen.getByRole('button', { name: 'Save' });
  act(() => { fireEvent.press(button); fireEvent.press(button); });
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button').props.accessibilityState.busy).toBe(true);
  await act(async () => { finish?.(); });
  expect(screen.getByRole('button')).not.toBeDisabled();
});

it('uses English fonts and a scalable touch target when the language is English', () => {
  const screen = render(<DirContext.Provider value={buildDirState('en')}><PrimaryButton label="Continue" height={20} onPress={jest.fn()} /></DirContext.Provider>);
  expect(screen.getByText('Continue')).toHaveStyle({ fontFamily: 'IBMPlexSansArabic_600SemiBold', writingDirection: 'ltr' });
  const button = screen.getByRole('button');
  expect(button).toHaveStyle({ minHeight: 44 });
});
