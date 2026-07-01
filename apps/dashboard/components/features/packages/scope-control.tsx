"use client"

/**
 * ScopeControl — Sawaa Dashboard (packages feature)
 *
 * A per-dimension eligibility editor: a 3-way segmented control
 * (ANY «الكل» / INCLUDE «تحديد» / EXCLUDE «استثناء») and, when the mode is
 * INCLUDE/EXCLUDE, a compact multi-select of targets.
 *
 * Controlled: `mode` + `ids` in, `onChange({ mode, ids })` out. Switching to
 * ANY clears `ids`. The segmented control uses the design-token surface — no
 * raw colours.
 */

import { Label } from "@sawaa/ui"

import { useLocale } from "@/components/locale-provider"
import { cn } from "@/lib/utils"
import type { PackageConstraintMode } from "@/lib/types/package"
import { MultiSelect, type MultiSelectOption } from "./multi-select"

interface ScopeControlProps {
  label: string
  mode: PackageConstraintMode
  ids: string[]
  onChange: (next: { mode: PackageConstraintMode; ids: string[] }) => void
  options: MultiSelectOption[]
  /** Custom labels for the segmented control (defaults to الكل/تحديد/استثناء). */
  modeLabels?: { ANY: string; INCLUDE: string; EXCLUDE: string }
  /** Whether to render the EXCLUDE segment. Delivery-type keeps all three. */
  allowExclude?: boolean
  selectPlaceholder: string
  searchPlaceholder: string
  emptyLabel: string
  disabled?: boolean
  error?: string
  id?: string
}

export function ScopeControl({
  label,
  mode,
  ids,
  onChange,
  options,
  modeLabels,
  allowExclude = true,
  selectPlaceholder,
  searchPlaceholder,
  emptyLabel,
  disabled,
  error,
  id,
}: ScopeControlProps) {
  const { t } = useLocale()

  const labels = modeLabels ?? {
    ANY: t("packages.scope.any"),
    INCLUDE: t("packages.scope.include"),
    EXCLUDE: t("packages.scope.exclude"),
  }

  const modes: PackageConstraintMode[] = allowExclude
    ? ["ANY", "INCLUDE", "EXCLUDE"]
    : ["ANY", "INCLUDE"]

  const setMode = (next: PackageConstraintMode) => {
    onChange({ mode: next, ids: next === "ANY" ? [] : ids })
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>

      <div
        role="group"
        aria-label={label}
        className="inline-flex rounded-lg border border-border bg-surface-muted p-0.5"
      >
        {modes.map((m) => (
          <button
            key={m}
            type="button"
            disabled={disabled}
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
              mode === m
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {labels[m]}
          </button>
        ))}
      </div>

      {mode !== "ANY" && (
        <MultiSelect
          id={id}
          options={options}
          value={ids}
          onChange={(next) => onChange({ mode, ids: next })}
          placeholder={selectPlaceholder}
          searchPlaceholder={searchPlaceholder}
          emptyLabel={emptyLabel}
          disabled={disabled}
        />
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
