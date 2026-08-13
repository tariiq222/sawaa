const PENDING_CHAT_KEY = 'sawaa-chat-resume';
const REOPEN_CHAT_KEY = 'sawaa-chat-reopen';
const SAFE_CONVERSATION_ID = /^[A-Za-z0-9_-]{1,100}$/;

function sessionStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function savePendingChatResume(conversationId: string): boolean {
  if (!SAFE_CONVERSATION_ID.test(conversationId)) return false;
  try {
    sessionStorage()?.setItem(PENDING_CHAT_KEY, conversationId);
    return true;
  } catch {
    return false;
  }
}

export function readPendingChatResume(): string | null {
  try {
    const value = sessionStorage()?.getItem(PENDING_CHAT_KEY) ?? null;
    return value && SAFE_CONVERSATION_ID.test(value) ? value : null;
  } catch {
    return null;
  }
}

export function clearPendingChatResume(): void {
  try {
    sessionStorage()?.removeItem(PENDING_CHAT_KEY);
  } catch {
    // A blocked storage API must not block authentication.
  }
}

export function markChatForReopen(): void {
  try {
    sessionStorage()?.setItem(REOPEN_CHAT_KEY, '1');
  } catch {
    // The explicit ?chat=resume return path remains available.
  }
}

export function consumeChatReopen(): boolean {
  try {
    const storage = sessionStorage();
    const reopen = storage?.getItem(REOPEN_CHAT_KEY) === '1';
    storage?.removeItem(REOPEN_CHAT_KEY);
    return reopen;
  } catch {
    return false;
  }
}
