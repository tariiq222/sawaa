import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { UnverifiedEmailBanner } from './UnverifiedEmailBanner';
const mockSend = jest.fn();
let mockUser: { role: string; emailVerifiedAt: string | null } | null;
let mockPending = false;
jest.mock('@/hooks/use-redux', () => ({ useAppSelector: () => mockUser }));
jest.mock('@/hooks/queries', () => ({ useRequestEmailVerification: () => ({ mutateAsync: mockSend, isPending: mockPending }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(), scheme: 'light', isRTL: true, language: 'ar' }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => jest.requireActual('@/hooks/useDir').buildDirState('ar') }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light' } }));
beforeEach(() => { jest.clearAllMocks(); mockPending = false; mockUser = { role: 'EMPLOYEE', emailVerifiedAt: null }; });
it('announces request failure and allows a retry', async () => {
 mockSend.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
 const view = render(<UnverifiedEmailBanner />);
 await act(async () => { fireEvent.press(view.getByRole('button', { name: 'settings.sendVerification' })); });
 expect(view.getByRole('alert').props.children).toBe('settings.verificationError');
 await act(async () => { fireEvent.press(view.getByRole('button', { name: 'common.retry' })); });
 expect(view.getByText('settings.verificationSent')).toBeTruthy();
 expect(mockSend).toHaveBeenCalledTimes(2);
});
it.each(['client', 'verified', 'none'])('stays absent for %s', state => {
 mockUser = state === 'none' ? null : { role: state === 'client' ? 'CLIENT' : 'EMPLOYEE', emailVerifiedAt: state === 'verified' ? '2026-10-01' : null };
 const view = render(<UnverifiedEmailBanner />);
 expect(view.queryByText('settings.unverifiedEmail')).toBeNull();
 expect(mockSend).not.toHaveBeenCalled();
});
it('announces and prevents another send while pending', () => {
 mockPending = true; const view = render(<UnverifiedEmailBanner />);
 const action = view.getByRole('button', { name: 'settings.sendVerification' });
 expect(action.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
 fireEvent.press(action); expect(mockSend).not.toHaveBeenCalled();
});
it('announces verification link success', async () => {
 mockSend.mockResolvedValueOnce(undefined); const view = render(<UnverifiedEmailBanner />);
 await act(async () => { fireEvent.press(view.getByRole('button', { name: 'settings.sendVerification' })); });
 expect(view.getByText('settings.verificationSent')).toBeTruthy();
 expect(view.queryByText('settings.sendVerification')).toBeNull();
});
