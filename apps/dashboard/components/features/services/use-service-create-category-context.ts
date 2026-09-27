"use client"

import { useEffect } from "react"
import type { UseFormReturn } from "react-hook-form"
import type { CreateServiceFormData } from "@/components/features/services/create/form-schema"
import { useServiceFormCategories } from "@/hooks/use-service-form-categories"
import { getInitialCategoryContextValue, resolveCreateCategoryContext } from "@/components/features/services/service-form-context"

export function useServiceCreateCategoryContext(
  categoryId: string | null,
  hasCategoryContext: boolean,
  isEdit: boolean,
  form: UseFormReturn<CreateServiceFormData>,
) {
  const { data: categories = [], isLoading, isError } = useServiceFormCategories()
  const context = hasCategoryContext
    ? resolveCreateCategoryContext(categoryId, categories, { isLoading, isError })
    : undefined
  const validCategory = context?.status === "valid" ? context.category : undefined

  useEffect(() => {
    if (!validCategory || isEdit) return
    const initialCategoryId = getInitialCategoryContextValue(
      validCategory.id,
      form.getValues("categoryId"),
      form.getFieldState("categoryId").isDirty,
    )
    if (initialCategoryId) form.setValue("categoryId", initialCategoryId, { shouldValidate: true })
  }, [form, isEdit, validCategory])

  return { categories, context, validCategory }
}
