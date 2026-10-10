"use client"

import { useRef, useState } from "react"
import { createResumableSave } from "@/lib/catalog-creation"
import type { UpdateCategoryPayload } from "@/lib/types/service-payloads"
import type { ServiceCategory } from "@/lib/types/service"
import type { EditCategoryFormData } from "@/lib/schemas/service.schema"
import { buildCategoryCreatePayload, buildCategoryUpdatePayload } from "@/lib/category-payload"

/** Resume the same category when uploading fails after persistence. */
interface CategoryPersistence {
  create: (payload: ReturnType<typeof buildCategoryCreatePayload>) => Promise<ServiceCategory>
  update: (id: string, payload: UpdateCategoryPayload) => Promise<unknown>
  upload: (id: string, file: File) => Promise<unknown>
}

export function useCategoryCreation(persistence: CategoryPersistence, file: { current: File | null }, onUpload: () => void) {
  const save = useRef(createResumableSave<ServiceCategory>())
  const [record, setRecord] = useState<ServiceCategory | null>(null)
  const persist = (data: EditCategoryFormData) => save.current.run({
    create: async () => {
      const payload = buildCategoryCreatePayload(data)
      const created = await persistence.create(payload)
      const saved = { ...created, bookingMode: created.bookingMode ?? payload.bookingMode }
      setRecord(saved)
      return saved
    },
    resume: async (record) => {
      const { id: _id, ...payload } = buildCategoryUpdatePayload(record.id, { ...data, nameEn: data.nameEn ?? "" }, undefined, data.departmentId || null)
      await persistence.update(record.id, payload)
    },
    complete: async (record) => {
      if (!file.current) return
      await persistence.upload(record.id, file.current)
      file.current = null
      onUpload()
    },
  })
  return { save: persist, record }
}
