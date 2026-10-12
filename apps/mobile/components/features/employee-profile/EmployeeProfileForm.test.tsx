import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { EmployeeProfileForm, EmployeeProfileSaveBar, useEmployeeProfileDraft } from './EmployeeProfileForm';
import type { EmployeeProfileUpdate } from '@/services/employee/profile';
import { EmployeeContactEditor } from './EmployeeContactEditor';
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(), scheme: 'light', language: 'ar', isRTL: true }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => jest.requireActual('@/hooks/useDir').buildDirState('ar') }));
function Harness({ onSave }: { onSave: (data: EmployeeProfileUpdate) => Promise<unknown> }) {
  const draft = useEmployeeProfileDraft(profile, onSave);
  return <><EmployeeProfileForm draft={draft} saving={false} /><EmployeeProfileSaveBar draft={draft} saving={false} /></>;
}
const profile = { id: 'e', name: 'Nora', bioAr: 'نبذة قديمة', bioEn: null, experience: 4, languages: ['العربية'], avatarUrl: null, email: 'old@example.com', phone: '+966501234567' };

it('saves only biography, years and spoken languages', async () => {
  const save = jest.fn().mockResolvedValue(undefined);
  const view = render(<Harness onSave={save} />);
  fireEvent.changeText(view.getByLabelText('employeeSelfProfile.bioAr'), 'نبذة جديدة');
  fireEvent.changeText(view.getByLabelText('employeeSelfProfile.experience'), '7');
  fireEvent.changeText(view.getByLabelText('employeeSelfProfile.languages'), 'العربية، English');
  fireEvent.press(view.getByText('common.save'));
  await waitFor(() => expect(save).toHaveBeenCalledWith({ bioAr: 'نبذة جديدة', bioEn: '', experience: 7, languages: ['العربية', 'English'] }));
});
it('shows the save bar only while the form differs from the loaded profile', async () => {
  const save = jest.fn().mockResolvedValue(undefined);
  const view = render(<Harness onSave={save} />);
  expect(view.queryByText('common.save')).toBeNull();
  fireEvent.changeText(view.getByLabelText('employeeSelfProfile.experience'), '7');
  expect(view.getByText('common.save')).toBeTruthy();
  fireEvent.changeText(view.getByLabelText('employeeSelfProfile.experience'), '4');
  expect(view.queryByText('common.save')).toBeNull();
  fireEvent.changeText(view.getByLabelText('employeeSelfProfile.experience'), '8');
  fireEvent.press(view.getByText('common.save'));
  await waitFor(() => expect(view.getByText('employeeSelfProfile.saved')).toBeTruthy());
  expect(view.queryByText('common.save')).toBeNull();
});
it('rejects invalid years without submitting and preserves a failed save draft', async () => {
  const save = jest.fn().mockRejectedValue(new Error());
  const view = render(<Harness onSave={save} />);
  fireEvent.changeText(view.getByLabelText('employeeSelfProfile.experience'), '-1');
  fireEvent.press(view.getByText('common.save'));
  await waitFor(() => expect(view.getByText('employeeSelfProfile.invalidProfile')).toBeTruthy());
  expect(save).not.toHaveBeenCalled();
  fireEvent.changeText(view.getByLabelText('employeeSelfProfile.experience'), '9');
  fireEvent.press(view.getByText('common.save'));
  await waitFor(() => expect(view.getByText('employeeSelfProfile.saveError')).toBeTruthy());
  expect(view.getByLabelText('employeeSelfProfile.experience').props.value).toBe('9');
});
it('confirms the frozen new contact using the challenge instead of saving directly', async () => {
  const request = jest.fn().mockResolvedValue({ challengeId: 'challenge', expiresIn: 300, retryAfterSeconds: 60 });
  const verify = jest.fn().mockResolvedValue(undefined);
  const view = render(<EmployeeContactEditor channel="EMAIL" currentValue={profile.email} request={request} verify={verify} busy={false} />);
  fireEvent.changeText(view.getByLabelText('settings.email'), 'new@example.com');
  fireEvent.press(view.getByText('employeeSelfProfile.sendCode'));
  await waitFor(() => expect(view.getByLabelText('employeeSelfProfile.code')).toBeTruthy());
  expect(request).toHaveBeenCalledWith({ channel: 'EMAIL', identifier: 'new@example.com' });
  expect(view.getByLabelText('settings.email').props.editable).toBe(false);
  expect(verify).not.toHaveBeenCalled();
  fireEvent.changeText(view.getByLabelText('employeeSelfProfile.code'), '123456');
  fireEvent.press(view.getByText('employeeSelfProfile.confirmContact'));
  await waitFor(() => expect(verify).toHaveBeenCalledWith({ challengeId: 'challenge', code: '123456' }));
});
it('retains confirmation input after rejection and allows abandoning the pending change', async () => {
  const request = jest.fn().mockResolvedValue({ challengeId: 'challenge', expiresIn: 300, retryAfterSeconds: 60 });
  const verify = jest.fn().mockRejectedValue(new Error());
  const view = render(<EmployeeContactEditor channel="SMS" currentValue={profile.phone} request={request} verify={verify} busy={false} />);
  fireEvent.changeText(view.getByLabelText('settings.phone'), '+966509876543');
  fireEvent.press(view.getByText('employeeSelfProfile.sendCode'));
  await waitFor(() => expect(view.getByLabelText('employeeSelfProfile.code')).toBeTruthy());
  fireEvent.changeText(view.getByLabelText('employeeSelfProfile.code'), '123456');
  fireEvent.press(view.getByText('employeeSelfProfile.confirmContact'));
  await waitFor(() => expect(view.getByText('employeeSelfProfile.contactError')).toBeTruthy());
  expect(view.getByLabelText('employeeSelfProfile.code').props.value).toBe('123456');
  fireEvent.press(view.getByText('employeeSelfProfile.changeTarget'));
  expect(view.queryByLabelText('employeeSelfProfile.code')).toBeNull();
  expect(view.getByLabelText('settings.phone').props.editable).toBe(true);
});
