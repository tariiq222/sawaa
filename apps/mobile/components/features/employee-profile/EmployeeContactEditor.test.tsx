import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { EmployeeContactEditor } from './EmployeeContactEditor';
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(), scheme: 'light', language: 'ar', isRTL: true }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => jest.requireActual('@/hooks/useDir').buildDirState('ar') }));

const challenge = { challengeId: 'challenge', expiresIn: 300, retryAfterSeconds: 60 };

async function submitEmail(value: string) {
  const request = jest.fn().mockResolvedValue(challenge);
  const view = render(<EmployeeContactEditor channel="EMAIL" currentValue="old@example.com" request={request} verify={jest.fn()} busy={false} />);
  fireEvent.changeText(view.getByLabelText('settings.email'), value);
  await act(async () => { fireEvent.press(view.getByText('employeeSelfProfile.sendCode')); });
  return { request, view };
}

it.each(['not-an-email', 'a@b', 'a b@example.com', 'a..b@example.com', '@example.com'])(
  'rejects the malformed email %p without requesting a code',
  async (value) => {
    const { request, view } = await submitEmail(value);
    expect(request).not.toHaveBeenCalled();
    expect(view.getByText('employeeSelfProfile.invalidContact')).toBeTruthy();
  },
);

it.each(['new@example.com', 'first.last+tag@sub.example.co', "o'neil@example.org"])(
  'requests a code for the valid email %p',
  async (value) => {
    const { request, view } = await submitEmail(`  ${value}  `);
    expect(request).toHaveBeenCalledWith({ channel: 'EMAIL', identifier: value });
    expect(view.queryByText('employeeSelfProfile.invalidContact')).toBeNull();
  },
);
