"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ShieldBanIcon, ShieldPlusIcon } from "@hugeicons/core-free-icons"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@deqah/ui"
import { Button } from "@deqah/ui"
import { Badge } from "@deqah/ui"
import { Textarea } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import { useSetClientActiveWithToast } from "@/hooks/use-set-client-active"
import type { Client } from "@/lib/types/client"

/* ─── Props ─── */

interface Props {
  client: Client
}

/* ─── Helpers ─── */

function hasPassword(client: Client): boolean {
  const type = client.accountType?.toUpperCase()
  return type === "FULL"
}

/* ─── Component ─── */

export function ClientAccountToggle({ client }: Props) {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")

  const mutation = useSetClientActiveWithToast(client.id, (isActive) =>
    t(isActive ? "clients.account.enableSuccess" : "clients.account.disableSuccess"),
  )

  // Hide for guest/walk-in clients with no password
  if (!hasPassword(client)) return null

  const isActive = client.isActive

  function handleOpen() {
    setReason("")
    setOpen(true)
  }

  function handleConfirm() {
    mutation.mutate(
      { isActive: !isActive, reason: reason.trim() || undefined },
      { onSuccess: () => setOpen(false) },
    )
  }

  return (
    <>
      {/* ── Account Status Section ── */}
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">
            {t("clients.account.status")}
          </span>
          <Badge
            variant="outline"
            className={
              isActive
                ? "border-success/30 bg-success/10 text-success w-fit"
                : "border-destructive/30 bg-destructive/10 text-destructive w-fit"
            }
          >
            {isActive ? t("clients.account.active") : t("clients.account.disabled")}
          </Badge>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleOpen}
          className={
            isActive
              ? "gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
              : "gap-2 border-success/30 text-success hover:bg-success/10 hover:text-success"
          }
        >
          {isActive ? (
            <HugeiconsIcon icon={ShieldBanIcon} size={15} />
          ) : (
            <HugeiconsIcon icon={ShieldPlusIcon} size={15} />
          )}
          {isActive
            ? t("clients.account.disableButton")
            : t("clients.account.enableButton")}
        </Button>
      </div>

      {/* ── Confirmation Dialog ── */}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle
              className={isActive ? "text-destructive" : undefined}
            >
              {t(isActive ? "clients.account.disableTitle" : "clients.account.enableTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                isActive
                  ? "clients.account.disableDescription"
                  : "clients.account.enableDescription",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Reason field — disable flow only */}
          {isActive && (
            <div className="flex flex-col gap-2 pt-1">
              <Label htmlFor="disable-reason" className="text-sm">
                {t("clients.account.reason")}
              </Label>
              <Textarea
                id="disable-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="..."
                className="resize-none"
              />
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>
              {t("clients.delete.cancel")}
            </AlertDialogCancel>
            <Button
              variant={isActive ? "destructive" : "default"}
              onClick={handleConfirm}
              disabled={mutation.isPending}
            >
              {isActive ? t("clients.account.disableButton") : t("clients.account.enableButton")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
