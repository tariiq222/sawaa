import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { GuestSignInPrompt } from './GuestSignInPrompt';
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(), scheme: 'light', language: 'ar' }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => jest.requireActual('@/hooks/useDir').buildDirState('ar') }));
it.each(['primary', 'secondary'] as const)('shows the complete prompt and invokes the supplied %s action once', variant => {
 const onPress = jest.fn(); const description = 'Long appointment sign-in description. '.repeat(20);
 const view = render(<GuestSignInPrompt title="Appointments" description={description} actionLabel="Sign in" onPress={onPress} variant={variant} />);
 expect(view.getByText(description)).toBeTruthy(); fireEvent.press(view.getByRole('button', { name: 'Sign in' }));
 expect(onPress).toHaveBeenCalledTimes(1);
});
