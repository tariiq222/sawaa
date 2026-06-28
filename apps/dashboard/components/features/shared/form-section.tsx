import { useId, isValidElement, cloneElement, type ReactNode, type ReactElement } from "react"
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

/**
 * Wires WCAG 3.3.1 / 4.1.3 error semantics: when `error` is present, the
 * single child control receives `aria-invalid="true"` and `aria-describedby`
 * pointing at the error message, and the error <p> gets a matching id.
 * Falls back to rendering children untouched when there is no single element
 * child (e.g. composite controls), so existing markup is never broken.
 */
export function FormField({ label, required, children, error, className }: {
  label?: string
  required?: boolean
  children: ReactNode
  error?: string
  className?: string
}) {
  const reactId = useId()
  const errorId = `field-error-${reactId}`

  let control = children
  if (error && isValidElement(children)) {
    const child = children as ReactElement<{
      "aria-invalid"?: boolean | "true" | "false"
      "aria-describedby"?: string
    }>
    const describedBy = [child.props["aria-describedby"], errorId]
      .filter(Boolean)
      .join(" ")
    control = cloneElement(child, {
      "aria-invalid": "true",
      "aria-describedby": describedBy,
    })
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && <Label>{label}{required && <span className="ms-0.5 text-destructive">*</span>}</Label>}
      {control}
      {error && <p id={errorId} className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
