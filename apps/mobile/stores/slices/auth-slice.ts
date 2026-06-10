import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { AuthState, User } from '@/types/auth';

const initialState: AuthState = {
  token: null,
  refreshToken: null,
  user: null,
  isLoading: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(
      state,
      action: PayloadAction<{
        accessToken: string;
        refreshToken: string;
        user: User;
      }>,
    ) {
      state.token = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.user = action.payload.user;
    },
    setAuthSession(
      state,
      action: PayloadAction<{
        tokens: { accessToken: string; refreshToken: string };
      }>,
    ) {
      state.token = action.payload.tokens.accessToken;
      state.refreshToken = action.payload.tokens.refreshToken;
    },
    setToken(state, action: PayloadAction<string>) {
      state.token = action.payload;
    },
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    logout(state) {
      state.token = null;
      state.refreshToken = null;
      state.user = null;
    },
  },
});

export const { setCredentials, setAuthSession, setToken, setUser, setLoading, logout } =
  authSlice.actions;
export default authSlice.reducer;
