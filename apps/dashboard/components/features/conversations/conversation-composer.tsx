"use client"

import { useState } from "react"
import { Button, Label, Textarea } from "@sawaa/ui"
import { HugeiconsIcon } from "@hugeicons/react"
import { MessageOutgoing02Icon } from "@hugeicons/core-free-icons"

interface ConversationComposerProps {
  isPending: boolean
  t: (key: string) => string
  onSend: (body: string) => Promise<boolean>
}

export function ConversationComposer({ isPending, t, onSend }: ConversationComposerProps) {
  const [body, setBody] = useState("")

  const submit = async () => {
    const submittedBody = body
    const trimmed = body.trim()
    if (!trimmed || isPending) return
    if (await onSend(trimmed)) {
      setBody((currentBody) => currentBody === submittedBody ? "" : currentBody)
    }
  }

  return (
    <div className="border-t border-border/70 pt-4">
      <Label htmlFor="conversation-reply" className="mb-2 block text-sm">
        {t("conversations.composer.label")}
      </Label>
      <div className="flex items-end gap-2">
        <Textarea
          id="conversation-reply"
          value={body}
          rows={2}
          maxLength={4000}
          className="min-h-20 resize-none bg-surface-solid"
          placeholder={t("conversations.composer.placeholder")}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              void submit()
            }
          }}
        />
        <Button type="button" className="shrink-0" disabled={!body.trim() || isPending} onClick={() => void submit()}>
          <HugeiconsIcon icon={MessageOutgoing02Icon} size={16} aria-hidden="true" />
          {t("conversations.composer.send")}
        </Button>
      </div>
    </div>
  )
}
