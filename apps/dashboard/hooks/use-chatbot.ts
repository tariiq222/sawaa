/**
 * Chatbot Hooks — barrel re-export
 *
 * Imports are preserved for backward compatibility.
 * Each domain is implemented in its own focused file:
 *   - use-chat-sessions.ts     → useChatSessions, useChatSession
 *   - use-chatbot-config.ts    → useChatbotConfig, useKnowledgeBase, useKnowledgeFiles
 *   - use-chatbot-mutations.ts → useChatbotMutations
 *
 * Note: analytics stubs (`useChatbotAnalytics`, `useTopQuestions`) were
 * removed because the AI cluster has no analytics endpoints today.
 */

export * from "./use-chat-sessions"
export * from "./use-chatbot-config"
export * from "./use-chatbot-mutations"
