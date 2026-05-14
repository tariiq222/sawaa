import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { AuthState, User, ActiveMembership } from '@/types/auth';

const initialState: AuthState = {
  token: null,
  refreshToken: null,
  user: null,
  isLoading: false,
  organizationId: null,
  activeMembership: null,
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
      state.organizationId = action.payload.user.organizationId ?? null;
    },
    setAuthSession(
      state,
      action: PayloadAction<{
        tokens: { accessToken: string; refreshToken: string };
        activeMembership: ActiveMembership | null;
      }>,
    ) {
      state.token = action.payload.tokens.accessToken;
      state.refreshToken = action.payload.tokens.refreshToken;
      state.activeMembership = action.payload.activeMembership;
      if (action.payload.activeMembership) {
        state.organizationId = action.payload.activeMembership.organizationId;
      }
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
      state.organizationId = null;
      state.activeMembership = null;
    },
    setOrganizationId(state, action: PayloadAction<string | null>) {
      state.organizationId = action.payload;
    },
  },
});

export const { setCredentials, setAuthSession, setToken, setUser, setLoading, logout, setOrganizationId } =
  authSlice.actions;
export default authSlice.reducer;
