import React from 'react';
import { render } from '@testing-library/react-native';

let mockAuthState: { token: string | null; user: { role: string } | null };
let mockStackOptions: unknown;

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const React = jest.requireActual<typeof import('react')>('react');
    const { Text: NativeText } = jest.requireActual<typeof import('react-native')>('react-native');
    return React.createElement(NativeText, null, `redirect:${href}`);
  },
  Slot: () => {
    const React = jest.requireActual<typeof import('react')>('react');
    const { Text: NativeText } = jest.requireActual<typeof import('react-native')>('react-native');
    return React.createElement(NativeText, null, 'slot');
  },
  Stack: ({ screenOptions }: { screenOptions: unknown }) => {
    mockStackOptions = screenOptions;
    const React = jest.requireActual<typeof import('react')>('react');
    const { Text: NativeText } = jest.requireActual<typeof import('react-native')>('react-native');
    return React.createElement(NativeText, null, 'native-stack');
  },
}));
jest.mock('@/hooks/use-redux', () => ({
  useAppSelector: (selector: (state: { auth: typeof mockAuthState }) => unknown) =>
    selector({ auth: mockAuthState }),
}));
jest.mock('@/hooks/use-push-notifications', () => ({ usePushNotifications: jest.fn() }));
import ClientLayout from '../(client)/_layout';
import EmployeeLayout from '../(employee)/_layout';

describe('protected route layouts', () => {
  it('keeps the client login guard and presents authenticated routes in a stack', () => {
    mockAuthState = { token: null, user: null };
    expect(render(<ClientLayout />).getByText('redirect:/(auth)/login')).toBeTruthy();

    mockAuthState = { token: 'token', user: { role: 'EMPLOYEE' } };
    expect(render(<ClientLayout />).getByText('redirect:/(employee)/(tabs)/today')).toBeTruthy();

    mockAuthState = { token: 'token', user: { role: 'CLIENT' } };
    expect(render(<ClientLayout />).getByText('native-stack')).toBeTruthy();
    expect(mockStackOptions).toEqual({ headerShown: false, gestureEnabled: true });
  });

  it('keeps the employee role redirect and presents employee routes in a stack', () => {
    mockAuthState = { token: null, user: null };
    expect(render(<EmployeeLayout />).getByText('redirect:/(auth)/login')).toBeTruthy();

    mockAuthState = { token: 'token', user: { role: 'CLIENT' } };
    expect(render(<EmployeeLayout />).getByText('redirect:/(client)/(tabs)/home')).toBeTruthy();

    mockAuthState = { token: 'token', user: { role: 'EMPLOYEE' } };
    expect(render(<EmployeeLayout />).getByText('native-stack')).toBeTruthy();
    expect(mockStackOptions).toEqual({ headerShown: false, gestureEnabled: true });
  });
});
