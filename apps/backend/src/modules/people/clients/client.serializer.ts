import type { Client } from '@prisma/client';

// Dashboard and mobile clients historically use lowercase enum values
// ("male" / "female", "walk_in" / "full"). Prisma emits the raw enum names
// (MALE, WALK_IN). Normalize on the way out so we don't have to touch every UI.
type ClientBookingSummary = {
  id: string;
  date: string;
  status: string;
};

// Sensitive auth columns on the Client row that must never be serialized out
// to the dashboard/mobile API surface (passwordHash + lockout/session state).
type SensitiveClientAuthField =
  | 'passwordHash'
  | 'tokenVersion'
  | 'loginAttempts'
  | 'lockoutUntil';

export type SerializedClient = Omit<
  Client,
  'gender' | 'accountType' | SensitiveClientAuthField
> & {
  gender: 'male' | 'female' | null;
  accountType: 'full' | 'walk_in';
  lastBooking?: ClientBookingSummary | null;
  nextBooking?: ClientBookingSummary | null;
};

type SerializeOptions = {
  lastBooking?: ClientBookingSummary | null;
  nextBooking?: ClientBookingSummary | null;
};

export function serializeClient(client: Client, options: SerializeOptions = {}): SerializedClient {
  // Strip sensitive auth columns so they never reach the API surface.
  const {
    passwordHash: _passwordHash,
    tokenVersion: _tokenVersion,
    loginAttempts: _loginAttempts,
    lockoutUntil: _lockoutUntil,
    ...safe
  } = client;

  return {
    ...safe,
    gender: client.gender ? (client.gender.toLowerCase() as 'male' | 'female') : null,
    accountType: client.accountType === 'FULL' ? 'full' : 'walk_in',
    lastBooking: options.lastBooking ?? null,
    nextBooking: options.nextBooking ?? null,
  };
}
