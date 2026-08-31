import { api } from "@/lib/api"

export type AiProvider = "OPENROUTER" | "OPENAI" | "MINIMAX"
export type AiProviderConfig = {
  provider: AiProvider
  model: string
  temperature: number
  maxTokens: number
  isEnabled: boolean
  connectionStatus: string
  lastTestedAt: string | null
  lastTestOk: boolean | null
  lastTestErrorCode: string | null
  hasCredential: boolean
}
export type AiProviderModels = { provider: AiProvider; models: string[]; allowCustom: boolean }
export type AiProviderTestResult = { ok: boolean; errorCode: string | null; testedAt: string | null; persisted: boolean }
export type AiProviderSettingsInput = { provider: AiProvider; model: string; temperature?: number; maxTokens?: number; isEnabled?: boolean }
export type AiProviderTestInput = AiProviderSettingsInput & { candidateApiKey: string; saveCredential?: boolean }

export function fetchSawaaAiSettings() { return api.get<AiProviderConfig>("/dashboard/ai/provider-config") }
export function fetchSawaaAiModels() { return api.get<AiProviderModels[]>("/dashboard/ai/provider-config/models") }
export function saveSawaaAiSettings(input: AiProviderSettingsInput) { return api.put<AiProviderConfig>("/dashboard/ai/provider-config", input) }
export function testSawaaAiConnection(input: AiProviderTestInput) { return api.post<AiProviderTestResult>("/dashboard/ai/provider-config/test", input) }
