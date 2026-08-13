/**
 * Translation dictionaries — Sawaa Dashboard
 */

import { en } from "./translations/en"
import { enChatbot } from "./translations/en.chatbot"
import { enChatbotExtended } from "./translations/en.chatbot-extended"
import { enWhatsapp } from "./translations/en.whatsapp"
import { enConversations } from "./translations/en.conversations"
import { ar } from "./translations/ar"
import { arChatbot } from "./translations/ar.chatbot"
import { arChatbotExtended } from "./translations/ar.chatbot-extended"
import { arWhatsapp } from "./translations/ar.whatsapp"
import { arConversations } from "./translations/ar.conversations"

export type Locale = "en" | "ar"

export const translations: Record<Locale, Record<string, string>> = {
  en: { ...en, ...enChatbot, ...enChatbotExtended, ...enWhatsapp, ...enConversations },
  ar: { ...ar, ...arChatbot, ...arChatbotExtended, ...arWhatsapp, ...arConversations },
}
