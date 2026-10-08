import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { buildTheme } from '@/theme/tokens';
import { buildDirState } from '@/hooks/useDir';
import { LabeledInput } from '../LabeledInput';
let mockScheme: 'light' | 'dark' = 'light';
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: mockScheme, theme: require('@/theme/tokens').buildTheme(null, mockScheme) }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => ({ 'common.showPassword': 'Show password', 'common.hidePassword': 'Hide password' })[key] ?? key }) }));
it.each(['light', 'dark'] as const)('names visibility and announces validation in %s', scheme => {
  mockScheme = scheme;
  const toggle = jest.fn();
  const view = render(<LabeledInput label="Password" value="secret" onChangeText={jest.fn()} dir={buildDirState('en')}
    secureTextEntry showVisibilityToggle isVisible={false} onToggleVisibility={toggle} error="Required" />);
  fireEvent.press(view.getByRole('button', { name: 'Show password' }));
  expect(toggle).toHaveBeenCalledTimes(1);
  expect(view.getByText('Required').props.accessibilityLiveRegion).toBe('polite');
  expect(view.getByText('Required')).toHaveStyle({ color: buildTheme(null, scheme).colors.error });
});
it('forwards native input semantics and input direction overrides', () => {
  const view = render(<LabeledInput label="Email" value="" onChangeText={jest.fn()} dir={buildDirState('ar')}
    autoComplete="email" inputStyle={{ textAlign: 'left', writingDirection: 'ltr' }} />);
  expect(view.getByLabelText('Email').props.autoComplete).toBe('email');
  expect(view.getByLabelText('Email')).toHaveStyle({ textAlign: 'left', writingDirection: 'ltr' });
});
it('keeps disabled input and visibility action inactive', () => {
  const toggle = jest.fn();
  const view = render(<LabeledInput label="Password" value="" onChangeText={jest.fn()} dir={buildDirState('en')}
    disabled secureTextEntry showVisibilityToggle onToggleVisibility={toggle} />);
  expect(view.getByLabelText('Password').props.editable).toBe(false);
  fireEvent.press(view.getByRole('button', { name: 'Show password' }));
  expect(toggle).not.toHaveBeenCalled();
});
it.each([{ disabled: true, readOnly: false }, { editable: false, readOnly: false }, { readOnly: true }])(
  'rejects edits when disabled, noneditable or read-only (%j)', restrictions => {
    const onChangeText = jest.fn();
    const view = render(<LabeledInput label="Protected" value="saved" onChangeText={onChangeText}
      dir={buildDirState('en')} {...restrictions} />);
    const field = view.getByLabelText('Protected');
    // RN readOnly overrides editable at the native boundary, so both must agree.
    expect(field.props.readOnly).toBe(true);
    expect(field.props.editable).toBe(false);
    fireEvent.changeText(field, 'changed');
    expect(onChangeText).not.toHaveBeenCalled();
  },
);
