"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import { Button } from "@deqah/ui"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@deqah/ui"
import { Input } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { Textarea } from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import { useChatbotMutations } from "@/hooks/use-chatbot"
import {
  createKbEntrySchema,
  type CreateKbEntryFormData,
} from "@/lib/schemas/chatbot.schema"

/* ─── Props ─── */

interface CreateKbEntryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ─── Component ─── */

export function CreateKbEntryDialog({
  open,
  onOpenChange,
}: CreateKbEntryDialogProps) {
  const { t } = useLocale()
  const { createKbEntryMut } = useChatbotMutations()

  const form = useForm<CreateKbEntryFormData>({
    resolver: zodResolver(createKbEntrySchema),
    defaultValues: {
      title: "",
      content: "",
      category: "",
    },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await createKbEntryMut.mutateAsync({
        title: data.title,
        content: data.content,
        category: data.category || undefined,
      })
      toast.success("Entry created")
      form.reset()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create entry")
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("chatbot.kb.addTitle")}</DialogTitle>
          <DialogDescription>{t("chatbot.kb.addDesc")}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form
            id="create-kb-entry-form"
            onSubmit={onSubmit}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label>{t("chatbot.kb.field.title")}</Label>
              <Input
                {...form.register("title")}
                placeholder={t("chatbot.kb.field.titlePlaceholder")}
              />
              {form.formState.errors.title && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.title.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label>{t("chatbot.kb.field.content")}</Label>
              <Textarea
                {...form.register("content")}
                placeholder={t("chatbot.kb.field.contentPlaceholder")}
                rows={5}
              />
              {form.formState.errors.content && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.content.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label>{t("chatbot.kb.field.category")}</Label>
              <Input
                {...form.register("category")}
                placeholder={t("chatbot.kb.field.categoryPlaceholder")}
              />
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            form="create-kb-entry-form"
            disabled={createKbEntryMut.isPending}
          >
            {createKbEntryMut.isPending
              ? t("chatbot.kb.creating")
              : t("chatbot.kb.createEntry")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
