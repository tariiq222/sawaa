export interface ChatSession {
  id: string;
  startedAt: string;
  endedAt?: string | null;
  handedOff: boolean;
  language?: string | null;
}

export interface ChatMessageResponse {
  message: string;
  intent?: string;
  toolName?: string;
  actionCard?: ActionCard;
}

export interface ActionCard {
  type:
    | 'booking_created'
    | 'bookings_list'
    | 'services_list'
    | 'employees_list'
    | 'slots_list'
    | 'cancellation_requested'
    | 'handoff';
  payload: unknown;
}

export interface QuickReply {
  label_ar: string;
  label_en: string;
  action: string;
}

export interface BotConfig {
  bot_name: string;
  bot_avatar_url: string | null;
  tone: string;
}

export interface CreateSessionResponse {
  session: ChatSession;
  welcomeMessage: string;
  quickReplies: QuickReply[];
  botConfig: BotConfig;
}

export interface ChatHistoryMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  intent?: string | null;
  toolName?: string | null;
  functionCall?: unknown;
  createdAt: string;
}

export interface SessionWithMessages extends ChatSession {
  messages: ChatHistoryMessage[];
  user: { id: string; firstName: string; lastName: string };
}
