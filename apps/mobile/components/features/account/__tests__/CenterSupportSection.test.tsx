import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

let mockPhone: string | null = '0558446605';
let mockBranch: { id: string; latitude: number | null; longitude: number | null } | undefined = { id: 'main', latitude: 24.7244103, longitude: 46.6477824 };

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/queries', () => ({
  useBranding: () => ({ data: { contactPhone: mockPhone } }),
  usePublicBranches: () => ({ data: mockBranch ? [{ id: mockBranch.id, isMain: true }] : [] }),
  usePublicBranch: (id: string | undefined) => ({ data: id ? mockBranch : undefined }),
}));
jest.mock('@/components/ui/MenuGroup', () => {
  const { Pressable, Text, View } = require('react-native');
  return { MenuGroup: ({ entries }: { entries: { key: string; label: string; onPress?: () => void }[] }) => (
    <View>{entries.map((e) => <Pressable key={e.key} accessibilityRole="button" accessibilityLabel={e.label} onPress={e.onPress}><Text>{e.label}</Text></Pressable>)}</View>
  ) };
});

import { CenterSupportSection } from '../CenterSupportSection';

beforeEach(() => { jest.restoreAllMocks(); mockPhone = '0558446605'; mockBranch = { id: 'main', latitude: 24.7244103, longitude: 46.6477824 }; });

it('offers a call and directions to the main branch in the maps app', async () => {
  jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  const screen = render(<CenterSupportSection />);
  fireEvent.press(screen.getByRole('button', { name: 'profile.crisisSupport.title' }));
  expect(open).toHaveBeenCalledWith('tel:0558446605');
  fireEvent.press(screen.getByRole('button', { name: 'profile.directions.title' }));
  await Promise.resolve(); await Promise.resolve();
  expect(open).toHaveBeenLastCalledWith(expect.stringContaining('24.7244103,46.6477824'));
});

it('hides directions without coordinates and the whole card without any data', () => {
  mockBranch = { id: 'main', latitude: null, longitude: null };
  const partial = render(<CenterSupportSection />);
  expect(partial.queryByText('profile.directions.title')).toBeNull();
  expect(partial.getByText('profile.crisisSupport.title')).toBeTruthy();
  mockPhone = null;
  const empty = render(<CenterSupportSection />);
  expect(empty.toJSON()).toBeNull();
});
