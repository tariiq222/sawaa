import { logout as logoutAction } from '@/stores/slices/auth-slice';
import { store } from '@/stores/store';
import {
  deleteSecureItem,
  setSecureItem,
} from '@/stores/secure-storage';
import { queryClient } from '@/services/query-client';

export type NativeSessionTokens = {
  accessToken: string;
  refreshToken: string;
};

let sessionEpoch = 0;
let logoutFenceEpoch: number | null = null;
let storageMutation = Promise.resolve();

function enqueueStorageMutation<T>(mutation: () => Promise<T>): Promise<T> {
  const next = storageMutation.then(mutation, mutation);
  storageMutation = next.then(() => undefined, () => undefined);
  return next;
}

export function getSessionEpoch(): number {
  return sessionEpoch;
}

export function beginSession(): number {
  sessionEpoch += 1;
  logoutFenceEpoch = null;
  queryClient.clear();
  return sessionEpoch;
}

/** Fence all work belonging to a session which is being logged out. */
export function fenceSession(): number {
  sessionEpoch += 1;
  logoutFenceEpoch = sessionEpoch;
  queryClient.clear();
  return sessionEpoch;
}

export function isSessionCurrent(epoch: number): boolean {
  return sessionEpoch === epoch;
}

/** Whether the current epoch was created by an explicit logout fence. */
export function isLogoutFenceActive(): boolean {
  return logoutFenceEpoch === sessionEpoch;
}

/** A refresh response may contain a server-side token issued just before logout. */
export function shouldRevokeStaleRefresh(epoch: number): boolean {
  return logoutFenceEpoch === epoch + 1 && sessionEpoch === logoutFenceEpoch;
}

export function persistSessionTokensAtEpoch(
  tokens: NativeSessionTokens,
  epoch: number,
): Promise<boolean> {
  return enqueueStorageMutation(async () => {
    if (!isSessionCurrent(epoch)) return false;

    await setSecureItem('accessToken', tokens.accessToken);
    // A logout or a newer login may have fenced this write while storage was
    // busy. Never let that stale operation restore the refresh token.
    if (!isSessionCurrent(epoch)) return false;

    await setSecureItem('refreshToken', tokens.refreshToken);
    return isSessionCurrent(epoch);
  });
}

export function clearSessionAtEpoch(epoch: number): Promise<boolean> {
  return enqueueStorageMutation(async () => {
    if (!isSessionCurrent(epoch)) return false;

    await deleteSecureItem('accessToken');
    if (!isSessionCurrent(epoch)) return false;

    await deleteSecureItem('refreshToken');
    if (!isSessionCurrent(epoch)) return false;

    store.dispatch(logoutAction());
    return true;
  });
}

export function clearSession(): Promise<boolean> {
  return clearSessionAtEpoch(fenceSession());
}
