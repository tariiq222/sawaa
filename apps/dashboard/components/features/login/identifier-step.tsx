"use client"

import { useState } from "react"
import { Button, Input, Label } from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import { identifierSchema } from "@/lib/schemas/auth-login.schema"

interface Props {
  initial: string
  loading: boolean
  onSubmit: (identifier: string) => void
}

export function IdentifierStep({ initial, loading, onSubmit }: Props) {
  const { t } = useLocale()
  const [value, setValue] = useState(initial)
  const [error, setError] = useState<string | null>(null)

  const handle = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = identifierSchema.safeParse(value.trim())
    if (!parsed.success) {
      setError(t("login.errors.identifierShape"))
      return
    }
    setError(null)
    onSubmit(parsed.data.trim())
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
          placeholder="user@example.com"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={loading}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <Button type="submit" disabled={loading || !value.trim()} className="w-full">
        {t("login.continue")}
      </Button>
    </form>
  )
}
