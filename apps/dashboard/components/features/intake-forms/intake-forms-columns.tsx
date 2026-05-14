"use client"

import { useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  PencilEdit01Icon,
  Delete02Icon,
  EyeIcon,
} from "@hugeicons/core-free-icons"
import { Badge } from "@deqah/ui"
import { Switch } from "@deqah/ui"
import { Tooltip, TooltipContent, TooltipTrigger } from "@deqah/ui"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@deqah/ui"
import { cn } from "@/lib/utils"
import type { IntakeForm, FormType } from "@/lib/types/intake-form"
import { FORM_TYPE_LABELS, FORM_SCOPE_LABELS } from "@/lib/types/intake-form"

const TYPE_BADGE_STYLES: Record<FormType, string> = {
  pre_booking: "bg-info/10 text-info border-info/20",
  pre_session: "bg-warning/10 text-warning border-warning/20",
  post_session: "bg-success/10 text-success border-success/20",
  registration: "bg-primary/10 text-primary border-primary/20",
}

interface ColumnCallbacks {
  isAr: boolean
  t: (key: string) => string
  onEdit: (form: IntakeForm) => void
  onDelete: (form: IntakeForm) => void
  onPreview: (form: IntakeForm) => void
  onToggleActive: (form: IntakeForm, value: boolean) => void
}

function IntakeFormActionsCell({
  form,
  t,
  onEdit,
  onDelete,
  onPreview,
}: {
  form: IntakeForm
  t: (key: string) => string
  onEdit: (form: IntakeForm) => void
  onDelete: (form: IntakeForm) => void
  onPreview: (form: IntakeForm) => void
}) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const btnBase =
    "flex size-9 items-center justify-center rounded-sm border border-transparent text-muted-foreground transition-all duration-200 hover:bg-muted hover:border-border hover:text-foreground"

  return (
    <>
      <div className="flex items-center gap-1 justify-end">
        <Tooltip>
          <TooltipTrigger asChild>
            <button className={btnBase} onClick={() => onPreview(form)} aria-label={t("intakeForms.col.preview")}>
              <HugeiconsIcon icon={EyeIcon} size={16} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{t("intakeForms.col.preview")}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className={btnBase} onClick={() => onEdit(form)} aria-label={t("intakeForms.col.edit")}>
              <HugeiconsIcon icon={PencilEdit01Icon} size={16} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{t("intakeForms.col.edit")}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className={cn(btnBase, "hover:text-destructive hover:bg-destructive/10 hover:border-destructive/20")}
              onClick={() => setDeleteOpen(true)}
              aria-label={t("intakeForms.col.delete")}
            >
              <HugeiconsIcon icon={Delete02Icon} size={16} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{t("intakeForms.col.delete")}</TooltipContent>
        </Tooltip>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("intakeForms.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("intakeForms.delete.confirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { setDeleteOpen(false); onDelete(form) }}
            >
              {t("intakeForms.col.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function getIntakeFormsColumns({
  isAr,
  t,
  onEdit,
  onDelete,
  onPreview,
  onToggleActive,
}: ColumnCallbacks): ColumnDef<IntakeForm>[] {
  return [
    {
      id: "name",
      header: t("intakeForms.col.name"),
      enableSorting: false,
      cell: ({ row }) => {
        const form = row.original
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground">
              {isAr ? form.nameAr : form.nameEn}
            </span>
            <span className="text-xs text-muted-foreground">
              {isAr ? form.nameEn : form.nameAr}
            </span>
          </div>
        )
      },
    },
    {
      id: "type",
      header: t("intakeForms.col.type"),
      cell: ({ row }) => {
        const type = row.original.type
        const label = isAr ? FORM_TYPE_LABELS[type].ar : FORM_TYPE_LABELS[type].en
        return (
          <Badge
            variant="outline"
            className={cn("font-medium", TYPE_BADGE_STYLES[type])}
          >
            {label}
          </Badge>
        )
      },
    },
    {
      id: "scope",
      header: t("intakeForms.col.scope"),
      cell: ({ row }) => {
        const { scope, scopeLabel } = row.original
        const scopeName = isAr ? FORM_SCOPE_LABELS[scope].ar : FORM_SCOPE_LABELS[scope].en
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-foreground">{scopeName}</span>
            {scopeLabel && (
              <span className="text-xs text-muted-foreground">{scopeLabel}</span>
            )}
          </div>
        )
      },
    },
    {
      id: "fieldsCount",
      header: t("intakeForms.col.fields"),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-foreground">
          {row.original.fieldsCount}
        </span>
      ),
    },
    {
      id: "submissionsCount",
      header: t("intakeForms.col.submissions"),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm font-medium text-foreground">
          {row.original.submissionsCount.toLocaleString("en-US")}
        </span>
      ),
    },
    {
      id: "isActive",
      header: t("intakeForms.col.status"),
      cell: ({ row }) => {
        const form = row.original
        return (
          <div className="flex items-center gap-2">
            <Switch
              checked={form.isActive}
              onCheckedChange={(v) => onToggleActive(form, v)}
              aria-label={t("intakeForms.col.toggleStatus")}
            />
            <span className={cn("text-xs font-medium", form.isActive ? "text-success" : "text-muted-foreground")}>
              {form.isActive
                ? t("intakeForms.col.active")
                : t("intakeForms.col.inactive")}
            </span>
          </div>
        )
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <IntakeFormActionsCell
          form={row.original}
          t={t}
          onEdit={onEdit}
          onDelete={onDelete}
          onPreview={onPreview}
        />
      ),
    },
  ]
}
