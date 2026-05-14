import type { Client } from '@prisma/client';

// Dashboard and mobile clients historically use lowercase enum values
// ("male" / "female", "walk_in" / "full"). Prisma emits the raw enum names
// (MALE, WALK_IN). Normalize on the way out so we don't have to touch every UI.
export type ClientBookingSummary = {
  id: string;
  date: string;
  status: string;
};

export type SerializedClient = Omit<Client, 'gender' | 'accountType'> & {
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
  return {
    ...client,
    gender: client.gender ? (client.gender.toLowerCase() as 'male' | 'female') : null,
    accountType: client.accountType === 'FULL' ? 'full' : 'walk_in',
    lastBooking: options.lastBooking ?? null,
    nextBooking: options.nextBooking ?? null,
  };
}
