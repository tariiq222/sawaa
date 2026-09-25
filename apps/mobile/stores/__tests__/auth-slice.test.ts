import reducer, {
  logout,
  setAuthSession,
  setCredentials,
  setLoading,
  setToken,
  setUser,
} from '../slices/auth-slice';
import type { AuthState, User } from '@/types/auth';

const user = { id: 'u-1', role: 'CLIENT', firstName: 'Nora' } as unknown as User;

const initialState: AuthState = {
  token: null,
  refreshToken: null,
  user: null,
  isLoading: false,
};

describe('auth slice', () => {
  it('starts with no session', () => {
    expect(reducer(undefined, { type: 'unknown' })).toEqual(initialState);
  });

  it('stores the full credential set on login', () => {
    const state = reducer(
      initialState,
      setCredentials({ accessToken: 'a-1', refreshToken: 'r-1', user }),
    );
    expect(state).toEqual({ token: 'a-1', refreshToken: 'r-1', user, isLoading: false });
  });

  it('refreshes both tokens without dropping the user', () => {
    const signedIn = reducer(
      initialState,
      setCredentials({ accessToken: 'a-1', refreshToken: 'r-1', user }),
    );
    const refreshed = reducer(
      signedIn,
      setAuthSession({ tokens: { accessToken: 'a-2', refreshToken: 'r-2' } }),
    );
    expect(refreshed.token).toBe('a-2');
    expect(refreshed.refreshToken).toBe('r-2');
    expect(refreshed.user).toEqual(user);
  });

  it('updates token and user independently', () => {
    expect(reducer(initialState, setToken('a-3')).token).toBe('a-3');
    expect(reducer(initialState, setUser(user)).user).toEqual(user);
    expect(reducer(initialState, setLoading(true)).isLoading).toBe(true);
  });

  it('clears the whole session on logout', () => {
    const signedIn = reducer(
      initialState,
      setCredentials({ accessToken: 'a-1', refreshToken: 'r-1', user }),
    );
    expect(reducer(signedIn, logout())).toEqual(initialState);
    expect(reducer({ ...signedIn, isLoading: true }, logout()).isLoading).toBe(true);
  });
});
