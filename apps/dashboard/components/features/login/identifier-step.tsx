"use client"

import { useState } from "react"
import { Button, Input, Label } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { identifierSchema } from "@/lib/schemas/auth-login.schema"

interface Props {
  loading: boolean
  error: unknown
  onSubmit: (identifier: string) => void
  onClearError: () => void
}

export function IdentifierStep({ loading, error, onSubmit, onClearError }: Props) {
  const { t } = useLocale()
  const [identifier, setIdentifier] = useState("")
  const [fieldError, setFieldError] = useState("")

  const handle = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = identifierSchema.safeParse(identifier.trim())
    if (!parsed.success) {
      setFieldError(t("login.errors.identifierShape"))
      return
    }
    setFieldError("")
    onSubmit(parsed.data)
  }

  return (
    <form onSubmit={handle} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="identifier">{t("login.identifierLabel")}</Label>
        <Input
          id="identifier"
          dir="ltr"
          autoComplete="username"
          inputMode="email"
          placeholder={t("login.identifier.placeholder")}
          value={identifier}
          onChange={(e) => {
            setIdentifier(e.target.value)
            if (error) onClearError()
            if (fieldError) setFieldError("")
          }}
          disabled={loading}
        />
        {fieldError && (
          <p className="text-sm text-destructive">{fieldError}</p>
        )}
      </div>
      {!!error && (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : String(error)}
        </p>
      )}
      <Button type="submit" disabled={loading || !identifier.trim()} className="w-full">
        {loading ? t("login.signingIn") : t("login.continue")}
      </Button>
    </form>
  )
}
