/**
 * "Later" on the one-time client email prompt snoozes it for 7 days per user
 * id. This is a non-sensitive preference kept in AsyncStorage, with an
 * in-memory copy in case storage fails; the server is never told. Storage is
 * imported lazily so screens that only mount the prompt hook do not load it.
 */
type Storage = typeof import('@react-native-async-storage/async-storage').default;
const storage = (): Storage => {
  const loaded = require('@react-native-async-storage/async-storage');
  return loaded.default ?? loaded;
};

export const CLIENT_EMAIL_PROMPT_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

const snoozeKey = (userId: string) => `@sawaa/client-email-prompt-snooze/${userId}`;
const snoozedUntil = new Map<string, number>();

export async function snoozeClientEmailPrompt(userId: string, now = Date.now()): Promise<void> {
  const until = now + CLIENT_EMAIL_PROMPT_SNOOZE_MS;
  snoozedUntil.set(userId, until);
  try {
    await storage().setItem(snoozeKey(userId), String(until));
  } catch {
    // Memory copy still suppresses the prompt for this app session.
  }
}

export async function isClientEmailPromptSnoozed(userId: string, now = Date.now()): Promise<boolean> {
  let until = snoozedUntil.get(userId) ?? 0;
  if (!until) {
    try {
      until = Number(await storage().getItem(snoozeKey(userId))) || 0;
    } catch {
      until = 0;
    }
  }
  return until > now;
}

/** Test seam: forget the in-memory copy (storage is left alone). */
export function resetClientEmailSnoozeForTests(): void {
  snoozedUntil.clear();
}
