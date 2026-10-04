import React from 'react';
import { render } from '@testing-library/react-native';

let mockAuthState: { token: string | null; user: { role: string } | null };
let mockStackOptions: unknown;
let mockSegments: string[] = ['(client)', '(tabs)', 'home'];
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: unknown }) => {
    const React = jest.requireActual<typeof import('react')>('react');
    const { Text: NativeText } = jest.requireActual<typeof import('react-native')>('react-native');
    return React.createElement(NativeText, null, `redirect:${JSON.stringify(href)}`);
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
  useSegments: () => mockSegments,
  useGlobalSearchParams: () => mockParams,
}));
jest.mock('@/hooks/use-redux', () => ({
  useAppSelector: (selector: (state: { auth: typeof mockAuthState }) => unknown) =>
    selector({ auth: mockAuthState }),
}));
jest.mock('@/hooks/use-push-notifications', () => ({ usePushNotifications: jest.fn() }));
import ClientLayout from '../(client)/_layout';
import EmployeeLayout from '../(employee)/_layout';

/** Reads back the href the guard passed to `<Redirect>`. */
function redirectedHref(screen: { getByText: (matcher: RegExp) => { props: { children: unknown } } }) {
  const label = String(screen.getByText(/^redirect:/).props.children);
  return JSON.parse(label.replace('redirect:', '')) as unknown;
}

describe('protected route layouts', () => {
  beforeEach(() => {
    mockSegments = ['(client)', '(tabs)', 'home'];
    mockParams = {};
  });

  it('sends a signed-out client to login with the requested tab route', () => {
    mockAuthState = { token: null, user: null };

    expect(redirectedHref(render(<ClientLayout />))).toEqual({
      pathname: '/(auth)/login',
      params: { redirect: '/(client)/(tabs)/home' },
    });
  });

  it('keeps the role redirects and presents authenticated routes in a stack', () => {
    mockAuthState = { token: 'token', user: { role: 'EMPLOYEE' } };
    expect(redirectedHref(render(<ClientLayout />))).toEqual('/(employee)/(tabs)/today');

    mockAuthState = { token: 'token', user: { role: 'CLIENT' } };
    expect(render(<ClientLayout />).getByText('native-stack')).toBeTruthy();
    expect(mockStackOptions).toEqual(expect.objectContaining({ headerShown: false, gestureEnabled: true }));
  });

  it('keeps the employee role redirect and presents employee routes in a stack', () => {
    mockAuthState = { token: null, user: null };
    mockSegments = ['(employee)', '(tabs)', 'today'];
    expect(redirectedHref(render(<EmployeeLayout />))).toEqual({
      pathname: '/(auth)/login',
      params: { redirect: '/(employee)/(tabs)/today' },
    });

    mockAuthState = { token: 'token', user: { role: 'CLIENT' } };
    expect(redirectedHref(render(<EmployeeLayout />))).toEqual('/(client)/(tabs)/home');

    mockAuthState = { token: 'token', user: { role: 'EMPLOYEE' } };
    expect(render(<EmployeeLayout />).getByText('native-stack')).toBeTruthy();
    expect(mockStackOptions).toEqual(expect.objectContaining({ headerShown: false, gestureEnabled: true }));
  });

  it('carries dynamic segments and query params of the requested route', () => {
    mockAuthState = { token: null, user: null };
    mockSegments = ['(client)', 'appointment', '[id]'];
    mockParams = { id: 'booking-9' };

    expect(redirectedHref(render(<ClientLayout />))).toEqual({
      pathname: '/(auth)/login',
      params: { redirect: '/(client)/appointment/booking-9' },
    });

    mockSegments = ['(client)', 'video-call'];
    mockParams = { bookingId: 'booking-9' };

    expect(redirectedHref(render(<ClientLayout />))).toEqual({
      pathname: '/(auth)/login',
      params: { redirect: '/(client)/video-call?bookingId=booking-9' },
    });
  });
});
