/**
 * Translation dictionaries — Deqah Dashboard
 */

import { en } from "./translations/en"
import { enChatbot } from "./translations/en.chatbot"
import { enChatbotExtended } from "./translations/en.chatbot-extended"
import { ar } from "./translations/ar"
import { arChatbot } from "./translations/ar.chatbot"
import { arChatbotExtended } from "./translations/ar.chatbot-extended"

export type Locale = "en" | "ar"

export const translations: Record<Locale, Record<string, string>> = {
  en: { ...en, ...enChatbot, ...enChatbotExtended },
  ar: { ...ar, ...arChatbot, ...arChatbotExtended },
}
