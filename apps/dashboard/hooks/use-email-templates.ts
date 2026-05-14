"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
  fetchEmailTemplates,
  updateEmailTemplate,
  previewEmailTemplate,
} from "@/lib/api/email-templates"
import type {
  UpdateEmailTemplatePayload,
  TemplatePreviewPayload,
  TemplatePreviewResult,
} from "@/lib/types/email-template"

/* ─── List ─── */

export function useEmailTemplates() {
  return useQuery({
    queryKey: queryKeys.emailTemplates.list(),
    queryFn: fetchEmailTemplates,
    staleTime: 30 * 60 * 1000,
  })
}

/* ─── Mutations ─── */

export function useEmailTemplateMutations() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.emailTemplates.all })

  const updateMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & UpdateEmailTemplatePayload) =>
      updateEmailTemplate(id, payload),
    onSuccess: invalidate,
  })

  const previewMut = useMutation<
    TemplatePreviewResult,
    Error,
    { id: string } & TemplatePreviewPayload
  >({
    mutationFn: ({ id, ...payload }) => previewEmailTemplate(id, payload),
  })

  return { updateMut, previewMut }
}
