"use client"

import { useState } from "react"

import { Button } from "@deqah/ui"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@deqah/ui"

import { useLocale } from "@/components/locale-provider"
import type { Invoice } from "@/lib/types/invoice"

/* ─── Props ─── */

interface InvoiceActionsProps {
  invoice: Invoice
  onAction: () => void
}

/* ─── Component ─── */

export function InvoiceActions({ invoice, onAction }: InvoiceActionsProps) {
  const { t } = useLocale()
  const [htmlOpen, setHtmlOpen] = useState(false)

  return (
    <>
      <div className="flex flex-wrap gap-2 pb-4">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setHtmlOpen(true)}
        >
          {t("invoices.detail.close")}
        </Button>
      </div>

      {/* HTML Preview Sheet */}
      <Sheet open={htmlOpen} onOpenChange={setHtmlOpen}>
        <SheetContent side="end" className="overflow-y-auto w-full sm:max-w-[45vw]">
          <SheetHeader>
            <SheetTitle>
              {invoice.invoiceNumber}
            </SheetTitle>
          </SheetHeader>
          <SheetFooter>
            <Button variant="outline" onClick={() => setHtmlOpen(false)}>
              {t("invoices.detail.close")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
