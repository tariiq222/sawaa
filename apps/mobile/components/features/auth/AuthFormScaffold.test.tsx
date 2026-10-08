import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { AuthFormScaffold } from './AuthFormScaffold';
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 12 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(), scheme: 'light', language: 'ar' }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => jest.requireActual('@/hooks/useDir').buildDirState('ar') }));
it('invokes only the supplied back action', () => {
 const back = jest.fn();
 const view = render(<AuthFormScaffold title="Code" onBack={back}><Text>Resend</Text></AuthFormScaffold>);
 fireEvent.press(view.getByLabelText('a11y.buttonBack'));
 expect(back).toHaveBeenCalledTimes(1);
 expect(view.getByText('Resend')).toBeTruthy();
});
