import type { ReactNode } from "react"
import { Label } from "@sawaa/ui"
import { cn } from "@/lib/utils"

/**
 * Shared form layout primitives for create/edit pages.
 * FormSection = the card-with-section-title surface; FormField = label + control + error.
 * Reference design: services/category-form-page.tsx.
 */

export function FormSection({ title, description, children, className }: {
  title?: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn("rounded-2xl border border-border bg-surface-solid p-6 shadow-sm", className)}>
      {title && <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</h2>}
      {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      <div className={cn(title || description ? "mt-5" : undefined)}>{children}</div>
    </section>
  )
}

export function FormField({ label, required, children, error, className }: {
  label?: string
  required?: boolean
  children: ReactNode
  error?: string
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && <Label>{label}{required && <span className="ms-0.5 text-destructive">*</span>}</Label>}
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
