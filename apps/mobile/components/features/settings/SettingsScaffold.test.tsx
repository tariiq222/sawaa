import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { SettingsScaffold } from './SettingsScaffold';
const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockHistory = false;
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack, replace: mockReplace, canGoBack: () => mockHistory }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 12 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => jest.requireActual('@/hooks/useDir').buildDirState('ar') }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(), scheme: 'light', language: 'ar' }) }));
jest.mock('@/theme/sawaa/AquaBackground', () => ({ AquaBackground: require('react-native').View }));
beforeEach(() => { jest.clearAllMocks(); mockHistory = false; });
it('returns a cold settings link to the client account', () => {
 const view = render(<SettingsScaffold title="Profile" keyboardSafe><Text>Last field</Text></SettingsScaffold>);
 fireEvent.press(view.getByLabelText('a11y.buttonBack'));
 expect(mockReplace).toHaveBeenCalledWith('/(client)/(tabs)/account');
 expect(mockBack).not.toHaveBeenCalled();
});
it('returns through existing history', () => {
 mockHistory = true;
 const view = render(<SettingsScaffold title="Profile"><Text>Last field</Text></SettingsScaffold>);
 fireEvent.press(view.getByLabelText('a11y.buttonBack'));
 expect(mockBack).toHaveBeenCalledTimes(1);
 expect(mockReplace).not.toHaveBeenCalled();
});
