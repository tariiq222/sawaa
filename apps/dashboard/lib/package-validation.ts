export interface PackageValidationIssue {
  path: (string | number)[]
  message: string
}

/** Flatten RHF/Zod errors to stable field paths for summary + focus UX. */
export function collectPackageErrorPaths(
  value: unknown,
  prefix: string[] = []
): string[] {
  if (!value || typeof value !== "object") return []
  const record = value as Record<string, unknown>
  if (typeof record.message === "string") return [prefix.join(".")]
  return Object.entries(record).flatMap(([key, child]) =>
    key === "ref" || key === "types"
      ? []
      : collectPackageErrorPaths(child, [...prefix, key])
  )
}

export function packageIssuePaths(issues: PackageValidationIssue[]): string[] {
  return issues.map((issue) => issue.path.join(".")).filter(Boolean)
}

/** Focus the first invalid control, falling back to its package section. */
export function focusPackageError(path: string): void {
  if (typeof document === "undefined") return
  const candidates = [
    path,
    path.replace(/\.(ids|mode)$/, ""),
    path.split(".").slice(0, -1).join("."),
  ].filter(Boolean)
  const control = candidates
    .map((candidate) =>
      document.querySelector<HTMLElement>(
        `[name="${candidate}"], #${cssEscape(candidate)}`
      )
    )
    .find(Boolean)
  const section = document.querySelector<HTMLElement>(
    `[data-package-section="${path.split(".")[0]}"]`
  )
  const target = control ?? section
  if (!target) return
  target.focus({ preventScroll: true })
  target.scrollIntoView?.({ behavior: "smooth", block: "center" })
}

function cssEscape(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`)
}
