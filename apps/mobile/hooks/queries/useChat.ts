import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IMessage } from 'react-native-gifted-chat';

import { chatbotService } from '@/services/chatbot';
import type { BotConfig, QuickReply } from '@/types/chat';

export const chatKeys = {
  all: ['chat'] as const,
  session: (language?: string) => [...chatKeys.all, 'session', language ?? 'default'] as const,
};

interface ChatSessionData {
  sessionId: string;
  welcomeMessage: string;
  quickReplies: QuickReply[];
  botConfig: BotConfig;
}

/**
 * Chat state + mutations as a TanStack Query hook.
 * Replaces the legacy `chat-slice` Redux slice. Server data (session,
 * messages) lives in the query cache; transient UI state (typing, local
 * message list) stays in component-level `useState`.
 */
export function useChat(language?: string) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionQuery = useQuery<ChatSessionData>({
    queryKey: chatKeys.session(language),
    queryFn: async () => {
      const res = await chatbotService.createSession(language);
      if (!res.data) throw new Error('Failed to start chat session');
      return {
        sessionId: res.data.session.id,
        welcomeMessage: res.data.welcomeMessage,
        quickReplies: res.data.quickReplies,
        botConfig: res.data.botConfig,
      };
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });

  // Seed welcome message when a fresh session arrives.
  useEffect(() => {
    const data = sessionQuery.data;
    if (!data) return;
    setMessages([
      {
        _id: `welcome-${data.sessionId}`,
        text: data.welcomeMessage,
        createdAt: new Date(),
        user: { _id: 'bot', name: data.botConfig.bot_name },
      },
    ]);
    setError(null);
  }, [sessionQuery.data]);

  const sendMutation = useMutation({
    mutationFn: async ({ sessionId, content }: { sessionId: string; content: string }) => {
      const res = await chatbotService.sendMessage(sessionId, content);
      if (!res.data) throw new Error('Failed to send message');
      return res.data;
    },
    onMutate: () => {
      setIsTyping(true);
      setError(null);
    },
    onSuccess: (data) => {
      const botName = sessionQuery.data?.botConfig.bot_name ?? 'Assistant';
      setMessages((prev) => [
        {
          _id: `bot-${Date.now()}`,
          text: data.message,
          createdAt: new Date(),
          user: { _id: 'bot', name: botName },
        },
        ...prev,
      ]);
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    },
    onSettled: () => {
      setIsTyping(false);
    },
  });

  const sendMessage = useCallback(
    (msg: IMessage) => {
      const sessionId = sessionQuery.data?.sessionId;
      if (!sessionId) return;
      setMessages((prev) => [msg, ...prev]);
      sendMutation.mutate({ sessionId, content: msg.text });
    },
    [sessionQuery.data?.sessionId, sendMutation],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setIsTyping(false);
    setError(null);
    queryClient.removeQueries({ queryKey: chatKeys.session(language) });
    sessionQuery.refetch();
  }, [language, queryClient, sessionQuery]);

  return {
    sessionId: sessionQuery.data?.sessionId ?? null,
    messages,
    isTyping,
    isLoading: sessionQuery.isLoading,
    error: error ?? (sessionQuery.error instanceof Error ? sessionQuery.error.message : null),
    quickReplies: sessionQuery.data?.quickReplies ?? [],
    botConfig: sessionQuery.data?.botConfig ?? null,
    sendMessage,
    reset,
  };
}
