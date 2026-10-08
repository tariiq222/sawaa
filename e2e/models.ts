// Subscription-only model routing. The e2e adapter resolves its own stored
// ChatGPT login lazily on the first model call; no other application's
// credential store, API-key provider, or fallback is configured here.
import { chatgpt } from 'e2e/oauth/chatgpt';

// sol61-all-v1: account availability is checked separately; no fallback.
export const sol61 = chatgpt('gpt-6.1-sol');
