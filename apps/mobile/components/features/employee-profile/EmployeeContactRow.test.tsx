import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { EmployeeContactRow } from './EmployeeContactRow';
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(), scheme: 'light', language: 'ar', isRTL: true }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => jest.requireActual('@/hooks/useDir').buildDirState('ar') }));

it('shows the value and status, opens the sheet from the row and closes it after verification', async () => {
  const request = jest.fn().mockResolvedValue({ challengeId: 'challenge', expiresIn: 300, retryAfterSeconds: 60 });
  const verify = jest.fn().mockResolvedValue(undefined);
  const view = render(<EmployeeContactRow channel="EMAIL" currentValue="old@example.com" request={request} verify={verify} busy={false} />);
  expect(view.getByText('old@example.com')).toBeTruthy();
  expect(view.getByText('employeeSelfProfile.verified')).toBeTruthy();
  expect(view.queryByText('employeeSelfProfile.contactHint')).toBeNull();
  fireEvent.press(view.getByText('employeeSelfProfile.change'));
  expect(view.getByText('employeeSelfProfile.contactHint')).toBeTruthy();
  fireEvent.changeText(view.getByLabelText('settings.email'), 'new@example.com');
  fireEvent.press(view.getByText('employeeSelfProfile.sendCode'));
  await waitFor(() => expect(view.getByLabelText('employeeSelfProfile.code')).toBeTruthy());
  fireEvent.changeText(view.getByLabelText('employeeSelfProfile.code'), '123456');
  fireEvent.press(view.getByText('employeeSelfProfile.confirmContact'));
  await waitFor(() => expect(view.queryByText('employeeSelfProfile.contactHint')).toBeNull());
  expect(verify).toHaveBeenCalledWith({ challengeId: 'challenge', code: '123456' });
  expect(view.getByText('employeeSelfProfile.contactUpdated')).toBeTruthy();
});
it('marks a missing phone as not added', () => {
  const view = render(<EmployeeContactRow channel="SMS" currentValue={null} request={jest.fn()} verify={jest.fn()} busy={false} />);
  expect(view.getByText('employeeSelfProfile.notAdded')).toBeTruthy();
});
