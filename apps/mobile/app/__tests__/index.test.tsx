/**
 * app/index.tsx — auth gate routing tests
 *
 * Unauthenticated visitors land on the shared home, never on a protected route.
 *
 * Covers 7 routing paths:
 *  1. No token anywhere               → /home
 *  2. Stored token, profile throws    → /home
 *  3. Stored token, profile success:false → /home
 *  4. Valid stored token, CLIENT role → /(client)/(tabs)/home + setCredentials dispatched
 *  5. Valid stored token, EMPLOYEE    → /(employee)/(tabs)/today + setCredentials dispatched
 *  6. Redux already has CLIENT token  → /(client)/(tabs)/home, no authService calls
 *  7. Redux already has EMPLOYEE token → /(employee)/(tabs)/today, no authService calls
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

// ── mocks (must be hoisted before any import that uses them) ─────────────────

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({ theme: jest.requireActual('@/theme/tokens').buildTheme() }),
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
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

// ── imports after mocks ──────────────────────────────────────────────────────

import { authService } from '@/services/auth';
import type { User } from '@/types/auth';
import IndexScreen from '../index';

const mockedGetStoredTokens = authService.getStoredTokens as jest.Mock;
const mockedGetProfile = authService.getProfile as jest.Mock;

// ── fixtures ─────────────────────────────────────────────────────────────────

// Deprecated multi-tenant contract fields are intentionally omitted; the
// double assertion keeps the fixture compiling while the API contract sheds
// them in a staged cleanup.
const clientUser = {
  id: 'u1',
  email: 'client@test.com',
  name: 'Test Client',
  firstName: 'Test',
  lastName: 'Client',
  phone: null,
  gender: null,
  avatarUrl: null,
  isActive: true,
  role: 'CLIENT',
  customRoleId: null,
  isSuperAdmin: false,
  permissions: [],
  onboardingCompletedAt: null,
  emailVerified: true,
  createdAt: '2026-01-01T00:00:00Z',
} as unknown as User;

const employeeUser: User = {
  ...clientUser,
  id: 'u2',
  email: 'employee@test.com',
  name: 'Test Employee',
  firstName: 'Test',
  lastName: 'Employee',
  role: 'EMPLOYEE',
};

// ── mutable Redux state proxy ─────────────────────────────────────────────────
// Mutated by mockDispatch to simulate real Redux store updates so that the
// re-render triggered by setHydrating(false) sees the correct token/user.

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

// ── setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
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

// ── tests ────────────────────────────────────────────────────────────────────

describe('IndexScreen — unauthenticated paths route to public browsing', () => {
  it('routes to /home when no token is in Redux or SecureStore', async () => {
    mockedGetStoredTokens.mockResolvedValueOnce({
      accessToken: null,
      refreshToken: null,
    });

    render(<IndexScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/home');
    });
    expect(mockReplace).not.toHaveBeenCalledWith('/(client)/(tabs)/home');
  });

  it('routes to /home when stored token is expired (profile fetch throws)', async () => {
    mockedGetStoredTokens.mockResolvedValueOnce({
      accessToken: 'expired-token',
      refreshToken: 'refresh-token',
    });
    mockedGetProfile.mockRejectedValueOnce(new Error('401 Unauthorized'));

    render(<IndexScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/home');
    });
    expect(mockReplace).not.toHaveBeenCalledWith('/(client)/(tabs)/home');
  });

  it('routes to /home when profile fetch returns success: false', async () => {
    mockedGetStoredTokens.mockResolvedValueOnce({
      accessToken: 'some-token',
      refreshToken: 'refresh-token',
    });
    mockedGetProfile.mockResolvedValueOnce({ success: false, data: undefined });

    render(<IndexScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/home');
    });
  });
});

describe('IndexScreen — valid stored token routes to correct tab', () => {
  it('dispatches setCredentials and routes to client home for CLIENT role', async () => {
    mockedGetStoredTokens.mockResolvedValueOnce({
      accessToken: 'valid-access',
      refreshToken: 'valid-refresh',
    }).mockResolvedValueOnce({
      accessToken: 'fresh-access',
      refreshToken: 'fresh-refresh',
    });
    mockedGetProfile.mockResolvedValueOnce({ success: true, data: clientUser });

    render(<IndexScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(client)/(tabs)/home');
    });
    expect(mockDispatch).toHaveBeenCalled();
    expect(mockSetCredentials).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'fresh-access',
        refreshToken: 'fresh-refresh',
        user: clientUser,
      }),
    );
  });

  it('dispatches setCredentials and routes to employee home for EMPLOYEE role', async () => {
    mockedGetStoredTokens.mockResolvedValueOnce({
      accessToken: 'valid-access',
      refreshToken: 'valid-refresh',
    }).mockResolvedValueOnce({
      accessToken: 'fresh-access',
      refreshToken: 'fresh-refresh',
    });
    mockedGetProfile.mockResolvedValueOnce({ success: true, data: employeeUser });

    render(<IndexScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(employee)/(tabs)/today');
    });
    expect(mockDispatch).toHaveBeenCalled();
  });

  it('routes every authorized staff role to employee tabs', async () => {
    mockedGetStoredTokens.mockResolvedValueOnce({
      accessToken: 'valid-access',
      refreshToken: 'valid-refresh',
    }).mockResolvedValueOnce({
      accessToken: 'fresh-access',
      refreshToken: 'fresh-refresh',
    });
    mockedGetProfile.mockResolvedValueOnce({
      success: true,
      data: { ...employeeUser, role: 'RECEPTIONIST' },
    });

    render(<IndexScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(employee)/(tabs)/today');
    });
  });

  it('does not hydrate or navigate after logout supersedes the bootstrap request', async () => {
    let resolveStored!: (value: { accessToken: string; refreshToken: string }) => void;
    mockedGetStoredTokens.mockReturnValueOnce(new Promise((resolve) => {
      resolveStored = resolve;
    }));

    render(<IndexScreen />);
    mockSessionEpoch = 2;
    resolveStored({ accessToken: 'stale-access', refreshToken: 'stale-refresh' });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockedGetProfile).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('finishes at public browsing when an expired stored session is invalidated during bootstrap', async () => {
    mockedGetStoredTokens.mockResolvedValueOnce({
      accessToken: 'expired-access',
      refreshToken: 'expired-refresh',
    });
    mockedGetProfile.mockImplementationOnce(async () => {
      mockSessionEpoch = 2;
      mockLogoutFenceActive = true;
      throw new Error('401 Unauthorized');
    });

    render(<IndexScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/home');
    });
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('dispatches the fresh token pair after profile refreshes the stored session', async () => {
    mockedGetStoredTokens.mockResolvedValueOnce({
      accessToken: 'old-access',
      refreshToken: 'old-refresh',
    }).mockResolvedValueOnce({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });
    mockedGetProfile.mockResolvedValueOnce({ success: true, data: clientUser });

    render(<IndexScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(client)/(tabs)/home');
    });
    expect(mockSetCredentials).toHaveBeenCalledWith(expect.objectContaining({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    }));
  });
});

describe('IndexScreen — Redux already hydrated (skip SecureStore)', () => {
  it('routes to client home and skips authService calls when Redux has CLIENT token', async () => {
    setupSelector('existing-token', clientUser);

    render(<IndexScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(client)/(tabs)/home');
    });
    expect(mockedGetStoredTokens).not.toHaveBeenCalled();
    expect(mockedGetProfile).not.toHaveBeenCalled();
  });

  it('routes to employee home and skips authService calls when Redux has EMPLOYEE token', async () => {
    setupSelector('existing-token', employeeUser);

    render(<IndexScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(employee)/(tabs)/today');
    });
    expect(mockedGetStoredTokens).not.toHaveBeenCalled();
    expect(mockedGetProfile).not.toHaveBeenCalled();
  });
});
