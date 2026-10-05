// Subscription-only model routing. The e2e adapter resolves its own stored
// ChatGPT login lazily on the first model call; no other application's
// credential store, API-key provider, or fallback is configured here.
import { chatgpt } from 'e2e/oauth/chatgpt';

// The local SDK accepts vendor model IDs. Account availability requires a
// separately authorized provider check; do not silently substitute a model.
export const astra = chatgpt('gpt-6-astra');
