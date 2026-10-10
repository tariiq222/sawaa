import { arAuditStaff } from "./translations/ar.audit-staff"
import { enAuditStaff } from "./translations/en.audit-staff"
import { arAuditCatalog } from "./translations/ar.audit-catalog"
import { enAuditCatalog } from "./translations/en.audit-catalog"
import { arAuditFinance } from "./translations/ar.audit-finance"
import { enAuditFinance } from "./translations/en.audit-finance"
import { arAuditOperations } from "./translations/ar.audit-operations"
import { enAuditOperations } from "./translations/en.audit-operations"
import { arAuditPeople } from "./translations/ar.audit-people"
import { enAuditPeople } from "./translations/en.audit-people"
/**
 * Translation dictionaries — Sawaa Dashboard
 */

import { en } from "./translations/en"
import { enChatbot } from "./translations/en.chatbot"
import { enChatbotExtended } from "./translations/en.chatbot-extended"
import { enConversations } from "./translations/en.conversations"
import { ar } from "./translations/ar"
import { arChatbot } from "./translations/ar.chatbot"
import { arChatbotExtended } from "./translations/ar.chatbot-extended"
import { arConversations } from "./translations/ar.conversations"

export type Locale = "en" | "ar"

export const translations: Record<Locale, Record<string, string>> = {
  en: { ...en, ...enChatbot, ...enChatbotExtended, ...enConversations, ...enAuditPeople, ...enAuditOperations, ...enAuditFinance, ...enAuditCatalog, ...enAuditStaff },
  ar: { ...ar, ...arChatbot, ...arChatbotExtended, ...arConversations, ...arAuditPeople, ...arAuditOperations, ...arAuditFinance, ...arAuditCatalog, ...arAuditStaff },
}
