import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SawaaAiSettingsContent } from "@/components/features/settings/sawaa-ai-settings-content"

const mutateTest = vi.fn()
const mutateSave = vi.fn()
let config: Record<string, unknown> | undefined
let canManage = true
let modelsError = false
const refetchModels = vi.fn()
const emptyKnowledgePage = { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }

vi.mock("@/components/locale-provider", () => ({ useLocale: () => ({ t: (key: string) => key, locale: "en" }) }))
vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => ({ canDo: (_module: string, action: string) => canManage && (action === "read" || action === "manage") }) }))
vi.mock("@/hooks/use-sawaa-ai-settings", () => ({
  useSawaaAiSettings: () => ({ config, loading: false, error: null }),
  useSawaaAiModels: () => ({ data: [{ provider: "OPENROUTER", models: ["deepseek/deepseek-v4-flash-0731", "openai/gpt-4o-mini"], allowCustom: true }], isError: modelsError, isFetching: false, refetch: refetchModels }),
  useTestSawaaAiConnection: () => ({ mutateAsync: mutateTest, isPending: false }),
  useSaveSawaaAiSettings: () => ({ mutateAsync: mutateSave, isPending: false }),
}))
vi.mock("@/hooks/use-sawaa-ai-knowledge-base", () => ({
  useSawaaAiKnowledge: () => ({ data: { pages: [emptyKnowledgePage] }, isLoading: false, isError: false, isFetching: false, isFetchingNextPage: false, hasNextPage: false, refetch: vi.fn(), fetchNextPage: vi.fn() }),
  useSawaaAiKnowledgeDetail: () => ({ data: null, isLoading: false, isError: false, refetch: vi.fn() }),
  useSawaaAiKnowledgeMutations: () => ({ create: { mutateAsync: vi.fn(), isPending: false }, update: { mutateAsync: vi.fn(), isPending: false }, publish: { mutateAsync: vi.fn(), isPending: false }, unpublish: { mutateAsync: vi.fn(), isPending: false }, reindex: { mutateAsync: vi.fn(), isPending: false }, remove: { mutateAsync: vi.fn(), isPending: false } }),
}))

describe("Sawaa Ai settings", () => {
  beforeEach(() => {
    config = { provider: "OPENROUTER", model: "deepseek/deepseek-v4-flash-0731", temperature: 0.4, maxTokens: 800, isEnabled: false, connectionStatus: "NOT_TESTED", lastTestOk: null, hasCredential: false }
    canManage = true
    modelsError = false
    refetchModels.mockReset()
    mutateTest.mockReset().mockResolvedValue({ ok: true, persisted: true, errorCode: null, testedAt: new Date().toISOString() })
    mutateSave.mockReset().mockResolvedValue({ ...config, hasCredential: true, connectionStatus: "CONNECTED", lastTestOk: true })
  })

  it("keeps the API key write-only and sends it only through the connection test", async () => {
    render(<SawaaAiSettingsContent />)
    const key = screen.getByLabelText("sawaaAi.apiKey")
    expect(key).toHaveAttribute("type", "password")
    fireEvent.change(key, { target: { value: "sk-test-only" } })
    fireEvent.click(screen.getByRole("button", { name: "sawaaAi.test" }))
    await waitFor(() => expect(mutateTest).toHaveBeenCalledWith(expect.objectContaining({ candidateApiKey: "sk-test-only", saveCredential: true })))
    expect(mutateSave).not.toHaveBeenCalledWith(expect.objectContaining({ candidateApiKey: expect.anything() }))
  })

  it("blocks enabling until a successful matching test is available", () => {
    render(<SawaaAiSettingsContent />)
    const toggle = screen.getByRole("switch", { name: "sawaaAi.enable" })
    expect(toggle).toBeDisabled()
    expect(screen.getByText("sawaaAi.enableRequiresTest")).toBeInTheDocument()
  })

  it("tests the pinned OpenRouter model and does not offer OpenAI or MiniMax", async () => {
    render(<SawaaAiSettingsContent />)
    fireEvent.click(screen.getByRole("combobox", { name: "sawaaAi.provider" }))
    expect(screen.getByRole("option", { name: "OpenRouter" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "OpenAI" })).not.toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "MiniMax" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("option", { name: "OpenRouter" }))
    fireEvent.change(screen.getByLabelText("sawaaAi.apiKey"), { target: { value: "sk-cp-placeholder" } })
    fireEvent.click(screen.getByRole("button", { name: "sawaaAi.test" }))
    await waitFor(() => expect(mutateTest).toHaveBeenCalledWith(expect.objectContaining({
      provider: "OPENROUTER",
      model: "deepseek/deepseek-v4-flash-0731",
      candidateApiKey: "sk-cp-placeholder",
      saveCredential: true,
    })))
    expect(mutateSave).not.toHaveBeenCalled()
  })

  it("supports switching model and invalidates the local test identity", () => {
    render(<SawaaAiSettingsContent />)
    fireEvent.click(screen.getByRole("combobox", { name: "sawaaAi.model" }))
    fireEvent.click(screen.getByRole("option", { name: "openai/gpt-4o-mini" }))
    expect(screen.getByRole("combobox", { name: "sawaaAi.model" })).toHaveTextContent("openai/gpt-4o-mini")
    expect(screen.getByRole("switch", { name: "sawaaAi.enable" })).toBeDisabled()
  })

  it("shows a failed test and does not allow enabling", async () => {
    mutateTest.mockRejectedValueOnce(new Error("provider failure"))
    render(<SawaaAiSettingsContent />)
    fireEvent.change(screen.getByLabelText("sawaaAi.apiKey"), { target: { value: "sk-failure" } })
    fireEvent.click(screen.getByRole("button", { name: "sawaaAi.test" }))
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("sawaaAi.testFailed"))
    expect(screen.getByRole("switch", { name: "sawaaAi.enable" })).toBeDisabled()
  })

  it("saves settings without putting a blank key into the PUT payload", async () => {
    config = { ...config, hasCredential: true, connectionStatus: "CONNECTED", lastTestOk: true }
    render(<SawaaAiSettingsContent />)
    fireEvent.click(screen.getByRole("button", { name: "settings.save" }))
    await waitFor(() => expect(mutateSave).toHaveBeenCalledWith(expect.not.objectContaining({ candidateApiKey: expect.anything() })))
    expect(mutateSave).toHaveBeenCalledWith(expect.objectContaining({ provider: "OPENROUTER", model: "deepseek/deepseek-v4-flash-0731" }))
  })

  it("tests and persists a written credential when save is used for the initial setup", async () => {
    render(<SawaaAiSettingsContent />)
    fireEvent.change(screen.getByLabelText("sawaaAi.apiKey"), { target: { value: "sk-initial-setup" } })

    fireEvent.click(screen.getByRole("button", { name: "settings.save" }))

    await waitFor(() => expect(mutateTest).toHaveBeenCalledWith(expect.objectContaining({
      provider: "OPENROUTER",
      model: "deepseek/deepseek-v4-flash-0731",
      candidateApiKey: "sk-initial-setup",
      saveCredential: true,
    })))
    expect(mutateSave).not.toHaveBeenCalled()
    expect(screen.getByRole("status")).toHaveTextContent("sawaaAi.saved")
  })

  it("offers retry when model suggestions fail", () => {
    modelsError = true
    render(<SawaaAiSettingsContent />)
    expect(screen.getByRole("alert")).toHaveTextContent("sawaaAi.modelsFailed")
    fireEvent.click(screen.getByRole("button", { name: "common.retry" }))
    expect(refetchModels).toHaveBeenCalled()
  })

  it("renders read-only users without mutation controls", () => {
    canManage = false
    render(<SawaaAiSettingsContent />)
    expect(screen.getByText("sawaaAi.readOnly")).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "sawaaAi.provider" })).toBeDisabled()
    expect(screen.getByRole("combobox", { name: "sawaaAi.model" })).toBeDisabled()
    expect(screen.getByLabelText("sawaaAi.apiKey")).toBeDisabled()
    expect(screen.getByLabelText("sawaaAi.temperature")).toBeDisabled()
    expect(screen.getByLabelText("sawaaAi.maxTokens")).toBeDisabled()
    expect(screen.getByRole("switch", { name: "sawaaAi.enable" })).toBeDisabled()
    expect(screen.queryByRole("button", { name: "sawaaAi.test" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "settings.save" })).not.toBeInTheDocument()
  })

  it("keeps enablement blocked when the provider returns an unsuccessful test result", async () => {
    mutateTest.mockResolvedValueOnce({ ok: false, persisted: false, errorCode: "AUTH_FAILED", testedAt: new Date().toISOString() })
    render(<SawaaAiSettingsContent />)
    fireEvent.change(screen.getByLabelText("sawaaAi.apiKey"), { target: { value: "sk-invalid" } })
    fireEvent.click(screen.getByRole("button", { name: "sawaaAi.test" }))
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("sawaaAi.testFailed"))
    expect(screen.getByRole("switch", { name: "sawaaAi.enable" })).toBeDisabled()
  })

  it("enables after a matching successful test and saves isEnabled true", async () => {
    config = { ...config, hasCredential: true, connectionStatus: "CONNECTED", lastTestOk: true }
    render(<SawaaAiSettingsContent />)
    const toggle = screen.getByRole("switch", { name: "sawaaAi.enable" })
    expect(toggle).toBeEnabled()
    fireEvent.click(toggle)
    fireEvent.click(screen.getByRole("button", { name: "settings.save" }))
    await waitFor(() => expect(mutateSave).toHaveBeenCalledWith(expect.objectContaining({ isEnabled: true })))
  })
})
