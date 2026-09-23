import path from "node:path"
import { ESLint } from "eslint"
import { describe, expect, it } from "vitest"

const dashboardRoot = path.resolve(import.meta.dirname, "../../..")

async function lint(filePath: string, code: string) {
  const eslint = new ESLint({ cwd: dashboardRoot })
  const [result] = await eslint.lintText(code, { filePath })
  return result.messages.filter((message) => message.ruleId === "no-restricted-imports")
}

describe("dashboard feature boundaries", () => {
  it("rejects a feature importing another feature", async () => {
    const messages = await lint(
      "components/features/clients/boundary-probe.tsx",
      'import { EmployeeServiceRow } from "@/components/features/employees/employee-service-row"\n',
    )

    expect(messages.map((message) => message.message).join("\n")).toMatch(/Cross-feature import/)
  })

  it("rejects a relative import into another feature", async () => {
    const messages = await lint(
      "components/features/services/nested/boundary-probe.tsx",
      'import { RemoveServiceDialog } from "../../employees/remove-service-dialog"\n',
    )

    expect(messages.map((message) => message.message).join("\n")).toMatch(/Cross-feature import/)
  })

  it("allows a feature to import shared presentation", async () => {
    const messages = await lint(
      "components/features/clients/shared-probe.tsx",
      'import { EmployeeAvatar } from "@/components/features/shared/employee-avatar"\n',
    )

    expect(messages).toEqual([])
  })

  it("allows the declared settings composition exception", async () => {
    const messages = await lint(
      "components/features/settings/composition-probe.tsx",
      'import { ZoomSettingsForm } from "@/components/features/zoom/zoom-settings-form"\n',
    )

    expect(messages).toEqual([])
  })
})
