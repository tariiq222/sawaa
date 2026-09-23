import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import i18n from '@/i18n';
import { LANGUAGE_KEY, loadPreferredLanguage, useLanguagePreference } from '../language-preference';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('loadPreferredLanguage', () => {
  it('restores a supported persisted language', async () => {
    const getItem = jest.spyOn(AsyncStorage, 'getItem').mockResolvedValue('en');

    await expect(loadPreferredLanguage()).resolves.toBe('en');
    expect(getItem).toHaveBeenCalledWith(LANGUAGE_KEY);

    getItem.mockRestore();
  });

  it('falls back to Arabic for an unsupported saved value', async () => {
    const getItem = jest.spyOn(AsyncStorage, 'getItem').mockResolvedValue('fr');

    await expect(loadPreferredLanguage()).resolves.toBe('ar');

    getItem.mockRestore();
  });

  it('updates the live locale when the app language changes', async () => {
    const getItem = jest.spyOn(AsyncStorage, 'getItem').mockResolvedValue('en');
    const { result } = renderHook(() => useLanguagePreference());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.language).toBe('en');

    await act(async () => {
      await i18n.changeLanguage('ar');
    });

    expect(result.current.language).toBe('ar');
    getItem.mockRestore();
  });
});
