"use client"

import { useEffect, useRef, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon } from "@hugeicons/core-free-icons"

import { Input, Switch } from "@sawaa/ui"
import { cn } from "@/lib/utils"

/* ─── BufferCell ─── */

interface BufferCellProps {
  value: number
  isSaving: boolean
  ariaLabel: string
  unitLabel: string
  emptyHintLabel?: string
  onCommit: (next: number) => void
  className?: string
  min?: number
}

export function BufferCell({
  value,
  isSaving,
  ariaLabel,
  unitLabel,
  emptyHintLabel,
  onCommit,
  className,
  min = 0,
}: BufferCellProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  /* Autofocus + select on edit entry */
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const enterEdit = () => {
    if (isSaving) return
    setDraft(String(value))
    setEditing(true)
  }

  const commit = () => {
    if (draft == null) {
      setEditing(false)
      return
    }
    const parsed = Number(draft)
    setEditing(false)
    setDraft(null)
    if (Number.isNaN(parsed) || parsed < min) return
    if (parsed !== value) onCommit(parsed)
  }

  const cancel = () => {
    setEditing(false)
    setDraft(null)
  }

  if (editing) {
    return (
      <Input
        ref={inputRef}
        type="number"
        min={min}
        value={draft ?? ""}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            commit()
          } else if (e.key === "Escape") {
            e.preventDefault()
            cancel()
          }
        }}
        disabled={isSaving}
        aria-label={ariaLabel}
        className={cn("h-7 w-20 px-2 text-xs tabular-nums", className)}
      />
    )
  }

  const isEmpty = value <= 0

  return (
    <button
      type="button"
      onClick={enterEdit}
      disabled={isSaving}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-md border border-transparent px-2 text-xs tabular-nums transition-colors hover:border-border hover:bg-muted focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60",
        isEmpty ? "text-muted-foreground" : "text-foreground",
        className,
      )}
    >
      {isSaving ? (
        <>
          <HugeiconsIcon
            icon={Loading03Icon}
            size={12}
            className="animate-spin text-muted-foreground"
          />
          <span className="text-muted-foreground">…</span>
        </>
      ) : isEmpty ? (
        <span>{emptyHintLabel ?? "—"}</span>
      ) : (
        <>
          <span>{value}</span>
          <span className="text-muted-foreground">{unitLabel}</span>
        </>
      )}
    </button>
  )
}

/* ─── ActiveCell ─── */

interface ActiveCellProps {
  checked: boolean
  isSaving: boolean
  ariaLabel: string
  onChange: (next: boolean) => void
  className?: string
}

export function ActiveCell({
  checked,
  isSaving,
  ariaLabel,
  onChange,
  className,
}: ActiveCellProps) {
  return (
    <Switch
      checked={checked}
      onCheckedChange={onChange}
      disabled={isSaving}
      aria-label={ariaLabel}
      size="sm"
      className={className}
    />
  )
}
