import api from './api';
import type { ApiResponse } from '@/types/api';
import type {
  CreateSessionResponse,
  ChatMessageResponse,
  SessionWithMessages,
} from '@/types/chat';

export const chatbotService = {
  async createSession(language?: string) {
    const response = await api.post<ApiResponse<CreateSessionResponse>>(
      '/chatbot/sessions',
      { language },
    );
    return response.data;
  },

  async sendMessage(sessionId: string, content: string) {
    const response = await api.post<ApiResponse<ChatMessageResponse>>(
      `/chatbot/sessions/${sessionId}/messages`,
      { content },
    );
    return response.data;
  },

  async getSession(sessionId: string) {
    const response = await api.get<ApiResponse<SessionWithMessages>>(
      `/chatbot/sessions/${sessionId}`,
    );
    return response.data;
  },

  async endSession(sessionId: string) {
    const response = await api.post<ApiResponse<void>>(
      `/chatbot/sessions/${sessionId}/end`,
    );
    return response.data;
  },
};
