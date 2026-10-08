import React from 'react';
import { Linking } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { Program } from '@/services/client/group-sessions';
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: 'light' }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'en', isRTL: false, row: 'row', textAlign: 'left' }) }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: require('react-native').View }));
jest.mock('@/theme/components/Glass', () => ({ Glass: require('react-native').View }));
import { GroupCard } from '../GroupCard';
const group: Program = {
  id: 'program-1', ref: 1, title: 'برنامج', nameAr: 'برنامج', nameEn: 'Program',
  descriptionAr: null, descriptionEn: null, publicDescriptionAr: null, publicDescriptionEn: null,
  departmentId: 'department-1', branchId: 'branch-1', startDate: null, daysCount: 1, hoursPerDay: 1,
  minParticipants: 1, maxParticipants: 10, enrolledCount: 10, price: '10000', currency: 'SAR',
  depositEnabled: false, depositAmount: null, status: 'PUBLISHED', isPublic: true, isFull: true, spotsLeft: 0,
};
it('keeps full public programs reachable without enrolling or dialing', () => {
  const dial = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined); const open = jest.fn();
  const screen = render(<GroupCard group={group} onOpen={open} contactPhone="123" publicPreview />);
  expect(screen.getByText('Program')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'guest.viewDetails' }));
  expect(open).toHaveBeenCalledTimes(1); expect(dial).not.toHaveBeenCalled(); dial.mockRestore();
});
it('keeps client full contact behavior and detail fallback', async () => {
  const dial = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined); const open = jest.fn();
  const screen = render(<GroupCard group={group} onOpen={open} contactPhone="123" />);
  fireEvent.press(screen.getByRole('button', { name: 'groups.contactUs' }));
  expect(dial).toHaveBeenCalledWith('tel:123'); expect(open).not.toHaveBeenCalled();
  screen.rerender(<GroupCard group={group} onOpen={open} />);
  // The next user action occurs after the shared button's same-turn lock clears.
  await act(async () => { await Promise.resolve(); });
  fireEvent.press(screen.getByRole('button', { name: 'groups.contactUs' }));
  expect(open).toHaveBeenCalledTimes(1); dial.mockRestore();
});
