import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
const mockRouter = { replace: mockReplace };
let mockFocused = true;
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useIsFocused: () => mockFocused,
}));

const mockUseAppSelector = jest.fn();
const mockDispatch = jest.fn();
jest.mock('@/hooks/use-redux', () => ({
  useAppSelector: (...args: unknown[]) => mockUseAppSelector(...args),
  useAppDispatch: () => mockDispatch,
}));

jest.mock('@/services/auth', () => ({
  authService: {
    getStoredTokens: jest.fn(),
    getProfile: jest.fn(),
  },
}));

const mockSetCredentials = jest.fn(
  (p: unknown) => ({ type: 'auth/setCredentials', payload: p }),
);
jest.mock('@/stores/slices/auth-slice', () => ({
  setCredentials: (p: unknown) => mockSetCredentials(p),
}));

let mockSessionEpoch = 1;
let mockLogoutFenceActive = false;
jest.mock('@/services/native-session-state', () => ({
  getSessionEpoch: () => mockSessionEpoch,
  isLogoutFenceActive: () => mockLogoutFenceActive,
  isSessionCurrent: (epoch: number) => epoch === mockSessionEpoch,
}));

jest.mock('@/theme/sawaa/useSawaaColors', () => ({
  useSawaaColors: () => ({ teal: { 600: 'teal' } }),
}));

jest.mock('@/theme/sawaa', () => ({
  AquaBackground: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../(client)/(tabs)/home', () => {
  const { Text } = require('react-native');
  return function MockHomeScreen() {
    return <Text testID="guest-home-rendered">guest-home-rendered</Text>;
  };
});

import { authService } from '@/services/auth';
import type { User } from '@/types/auth';
import HomeRoute from '../(guest)/home';

const mockedGetStoredTokens = authService.getStoredTokens as jest.Mock;
const mockedGetProfile = authService.getProfile as jest.Mock;

const clientUser = {
  id: 'u-client',
  email: 'client@test.com',
  name: 'Client User',
  firstName: 'Client',
  lastName: 'User',
  role: 'CLIENT',
  isActive: true,
} as unknown as User;

const employeeUser = {
  id: 'u-staff',
  email: 'staff@test.com',
  name: 'Staff User',
  firstName: 'Staff',
  lastName: 'User',
  role: 'EMPLOYEE',
  isActive: true,
} as unknown as User;

let reduxAuthState: { token: string | null; user: User | null } = {
  token: null,
  user: null,
};

function setupSelector(token: string | null = null, user: User | null = null) {
  reduxAuthState = { token, user };
  mockUseAppSelector.mockImplementation((selector: (s: unknown) => unknown) =>
    selector({ auth: reduxAuthState }),
  );
}

describe('HomeRoute /home alias', () => {
  beforeEach(() => {
    mockFocused = true;
    mockReplace.mockReset();
    mockDispatch.mockReset();
    mockSetCredentials.mockClear();
    mockedGetStoredTokens.mockReset();
    mockedGetProfile.mockReset();
    mockSessionEpoch = 1;
    mockLogoutFenceActive = false;
    setupSelector(null, null);
    mockDispatch.mockImplementation(
      (action: { type?: string; payload?: Record<string, unknown> }) => {
        if (action?.type === 'auth/setCredentials' && action.payload) {
          reduxAuthState.token = action.payload.accessToken as string;
          reduxAuthState.user = action.payload.user as User;
        }
      },
    );
  });

  it('renders guest home directly when no token exists and no stored credentials are found', async () => {
    mockedGetStoredTokens.mockResolvedValue({ accessToken: null, refreshToken: null });

    const screen = render(<HomeRoute />);

    await waitFor(() => {
      expect(screen.getByTestId('guest-home-rendered')).toBeTruthy();
    });
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockedGetProfile).not.toHaveBeenCalled();
  });

  it('redirects an authenticated client to /(client)/(tabs)/home without rendering guest home', async () => {
    setupSelector('tok-123', clientUser);

    const screen = render(<HomeRoute />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(client)/(tabs)/home');
    });
    expect(screen.queryByTestId('guest-home-rendered')).toBeNull();
    expect(mockedGetStoredTokens).not.toHaveBeenCalled();
  });

  it('redirects an authenticated staff member to /(employee)/(tabs)/today without rendering guest home', async () => {
    setupSelector('tok-123', employeeUser);

    const screen = render(<HomeRoute />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(employee)/(tabs)/today');
    });
    expect(screen.queryByTestId('guest-home-rendered')).toBeNull();
    expect(mockedGetStoredTokens).not.toHaveBeenCalled();
  });

  it.each([
    ['client', clientUser, '/(client)/(tabs)/home'],
    ['staff', employeeUser, '/(employee)/(tabs)/today'],
  ] as const)('does not override foreground authentication for %s until home regains focus', async (_role, user, destination) => {
    mockedGetStoredTokens.mockResolvedValue({ accessToken: null, refreshToken: null });
    const screen = render(<HomeRoute />);
    await waitFor(() => expect(screen.getByTestId('guest-home-rendered')).toBeTruthy());

    // Pushed booking/authentication screens leave guest home mounted underneath.
    mockFocused = false;
    screen.rerender(<HomeRoute />);
    setupSelector('new-session', user);
    screen.rerender(<HomeRoute />);
    expect(mockReplace).not.toHaveBeenCalled();

    mockFocused = true;
    screen.rerender(<HomeRoute />);
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith(destination);
  });

  it('shows bounded loading state while hydrating stored tokens and redirects client after profile resolves', async () => {
    let resolveTokens!: (val: unknown) => void;
    mockedGetStoredTokens.mockReturnValueOnce(
      new Promise((res) => { resolveTokens = res; }),
    );
    mockedGetProfile.mockResolvedValue({ success: true, data: clientUser });

    const screen = render(<HomeRoute />);

    // Initially in hydration stage
    expect(screen.getByTestId('home-loading')).toBeTruthy();
    expect(screen.queryByTestId('guest-home-rendered')).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();

    // Resolve storage lookup
    mockedGetStoredTokens.mockResolvedValueOnce({ accessToken: 'access-tok', refreshToken: 'refresh-tok' });
    resolveTokens({ accessToken: 'access-tok', refreshToken: 'refresh-tok' });

    await waitFor(() => {
      expect(mockSetCredentials).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: 'access-tok',
          user: clientUser,
        }),
      );
      expect(mockReplace).toHaveBeenCalledWith('/(client)/(tabs)/home');
    });
    expect(screen.queryByTestId('guest-home-rendered')).toBeNull();
  });

  describe('hydration deadline', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => {
      cleanup();
      jest.useRealTimers();
    });

    it('shares one deadline across storage and profile lookup', async () => {
      let resolveTokens!: (value: unknown) => void;
      mockedGetStoredTokens.mockReturnValue(new Promise((resolve) => { resolveTokens = resolve; }));
      mockedGetProfile.mockReturnValue(new Promise(() => {}));
      const screen = render(<HomeRoute />);

      act(() => jest.advanceTimersByTime(10_000));
      await act(async () => {
        resolveTokens({ accessToken: 'pending-profile', refreshToken: 'refresh' });
      });
      expect(screen.getByTestId('home-loading')).toBeTruthy();

      act(() => jest.advanceTimersByTime(5_000));
      expect(screen.queryByTestId('home-loading')).toBeNull();
      expect(screen.getByTestId('guest-home-rendered')).toBeTruthy();
      expect(mockDispatch).not.toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it.each(['stored tokens', 'profile', 'fresh tokens'])(
      'expires pending %s hydration and ignores its late session',
      async (pendingStep) => {
        const tokens = { accessToken: 'late-access', refreshToken: 'late-refresh' };
        const profile = { success: true, data: clientUser };
        let resolvePending!: (value: unknown) => void;
        const pending = new Promise((resolve) => { resolvePending = resolve; });
        mockedGetStoredTokens.mockResolvedValue(tokens);
        mockedGetProfile.mockResolvedValue(profile);
        if (pendingStep === 'profile') {
          mockedGetProfile.mockReturnValueOnce(pending);
        } else if (pendingStep === 'fresh tokens') {
          mockedGetStoredTokens.mockResolvedValueOnce(tokens).mockReturnValueOnce(pending);
        } else {
          mockedGetStoredTokens.mockReturnValueOnce(pending);
        }

        const screen = render(<HomeRoute />);
        await act(async () => {});
        act(() => jest.advanceTimersByTime(14_999));
        expect(screen.getByTestId('home-loading')).toBeTruthy();

        act(() => jest.advanceTimersByTime(1));
        expect(screen.queryByTestId('home-loading')).toBeNull();
        expect(screen.getByTestId('guest-home-rendered')).toBeTruthy();
        expect(mockReplace).not.toHaveBeenCalled();

        await act(async () => {
          resolvePending(pendingStep === 'profile' ? profile : tokens);
        });
        expect(screen.getByTestId('guest-home-rendered')).toBeTruthy();
        expect(mockDispatch).not.toHaveBeenCalled();
        expect(mockReplace).not.toHaveBeenCalled();
        expect(reduxAuthState).toEqual({ token: null, user: null });
      },
    );
  });

  it('hydrates stored tokens for staff and redirects to employee tabs', async () => {
    mockedGetStoredTokens
      .mockResolvedValueOnce({ accessToken: 'staff-tok', refreshToken: 'staff-ref' })
      .mockResolvedValueOnce({ accessToken: 'staff-tok', refreshToken: 'staff-ref' });
    mockedGetProfile.mockResolvedValue({ success: true, data: employeeUser });

    const screen = render(<HomeRoute />);

    await waitFor(() => {
      expect(mockSetCredentials).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: 'staff-tok',
          user: employeeUser,
        }),
      );
      expect(mockReplace).toHaveBeenCalledWith('/(employee)/(tabs)/today');
    });
    expect(screen.queryByTestId('guest-home-rendered')).toBeNull();
  });

  it('falls back to guest home if stored token verification fails', async () => {
    mockedGetStoredTokens.mockResolvedValue({ accessToken: 'expired-tok', refreshToken: 'ref' });
    mockedGetProfile.mockRejectedValue(new Error('Unauthorized'));

    const screen = render(<HomeRoute />);

    await waitFor(() => {
      expect(screen.getByTestId('guest-home-rendered')).toBeTruthy();
    });
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockSetCredentials).not.toHaveBeenCalled();
  });

  it('hydrates profile when Redux has token but user is missing', async () => {
    setupSelector('tok-without-user', null);
    mockedGetStoredTokens.mockResolvedValue({ accessToken: 'tok-without-user', refreshToken: 'ref' });
    mockedGetProfile.mockResolvedValue({ success: true, data: clientUser });

    const screen = render(<HomeRoute />);
    expect(screen.queryByTestId('guest-home-rendered')).toBeNull();

    await waitFor(() => {
      expect(mockSetCredentials).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/(client)/(tabs)/home');
    });
  });

  it('never restores stale credentials after logout during profile lookup', async () => {
    mockedGetStoredTokens.mockResolvedValue({ accessToken: 'stale-tok', refreshToken: 'ref' });
    let resolveProfile!: (value: unknown) => void;
    mockedGetProfile.mockReturnValue(new Promise((resolve) => { resolveProfile = resolve; }));
    const screen = render(<HomeRoute />);
    await waitFor(() => expect(mockedGetProfile).toHaveBeenCalled());

    mockSessionEpoch += 1;
    mockLogoutFenceActive = true;
    resolveProfile({ success: true, data: clientUser });

    await waitFor(() => expect(screen.getByTestId('guest-home-rendered')).toBeTruthy());
    expect(mockSetCredentials).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('immediately settles on guest home after logout when logout fence is active', async () => {
    mockLogoutFenceActive = true;

    const screen = render(<HomeRoute />);

    expect(screen.getByTestId('guest-home-rendered')).toBeTruthy();
    expect(screen.queryByTestId('home-loading')).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockedGetStoredTokens).not.toHaveBeenCalled();
  });
});
