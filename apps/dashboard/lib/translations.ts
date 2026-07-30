/**
 * Translation dictionaries — Sawaa Dashboard
 */

import { en } from "./translations/en"
import { enChatbot } from "./translations/en.chatbot"
import { enChatbotExtended } from "./translations/en.chatbot-extended"
import { enWhatsapp } from "./translations/en.whatsapp"
import { ar } from "./translations/ar"
import { arChatbot } from "./translations/ar.chatbot"
import { arChatbotExtended } from "./translations/ar.chatbot-extended"
import { arWhatsapp } from "./translations/ar.whatsapp"

export type Locale = "en" | "ar"

export const translations: Record<Locale, Record<string, string>> = {
  en: { ...en, ...enChatbot, ...enChatbotExtended, ...enWhatsapp },
  ar: { ...ar, ...arChatbot, ...arChatbotExtended, ...arWhatsapp },
}
