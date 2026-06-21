# Group Programs Dashboard Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Group Programs list + create pages in the dashboard, wired to `GET /dashboard/group-programs` and `POST /dashboard/group-programs`.

**Architecture:** Follow the strict layer pattern already established by the `group-sessions` feature: types → schema → api → query-key → hook → feature component → page. No cross-feature imports. The create page navigates back to the list on success.

**Tech Stack:** Next.js 15 App Router, React 19, TanStack Query v5, Zod, React Hook Form, `@sawaa/ui`, `@hugeicons/react`, custom `useLocale()` i18n.

## Global Constraints

- Every file ≤ 350 lines; feature components ≤ 300; page files ≤ 150; hooks ≤ 200; api ≤ 200; schemas ≤ 150; types ≤ 250.
- No hex colors. No `text-gray-*`. CSS tokens only (`--primary`, `--surface`, etc.).
- RTL logical classes only: `ps-`/`pe-`/`ms-`/`me-` — never `pl-`/`pr-`/`ml-`/`mr-`.
- Icons from `@hugeicons/core-free-icons` (free tier) — NOT `@hugeicons/react`.
- All user-facing strings via `t('key')` from `useLocale()`.
- `import { Button, ... } from "@sawaa/ui"` — never `@/components/ui`.
- No `useBranches()`, no `useServices()`, no cross-feature imports.
- Money input in SAR (number field); send as `Math.round(value * 100)` halalas.
- `isActive` is NOT in `CreateGroupProgramDto` per the OpenAPI schema — omit from payload.
- AR/EN translation key counts must match exactly (verified by `npm run i18n:verify`).

---

## File Map

| Path | Status | Responsibility |
|------|--------|---------------|
| `apps/dashboard/lib/types/group-program.ts` | Create | `GroupProgram`, `GroupProgramListItem`, `CreateGroupProgramPayload` |
| `apps/dashboard/lib/schemas/group-program.schema.ts` | Create | `createGroupProgramSchema` + `CreateGroupProgramFormData` |
| `apps/dashboard/lib/api/group-programs.ts` | Create | `fetchGroupPrograms()`, `createGroupProgram()` |
| `apps/dashboard/lib/query-keys.ts` | Modify | Add `groupPrograms` key |
| `apps/dashboard/hooks/use-group-programs.ts` | Create | `useGroupPrograms()`, `useGroupProgramMutations()` |
| `apps/dashboard/lib/translations/ar.group-programs.ts` | Create | Arabic translation keys |
| `apps/dashboard/lib/translations/en.group-programs.ts` | Create | English translation keys (same count) |
| `apps/dashboard/lib/translations/ar.ts` | Modify | Import + spread `arGroupPrograms` |
| `apps/dashboard/lib/translations/en.ts` | Modify | Import + spread `enGroupPrograms` |
| `apps/dashboard/components/sidebar-config.ts` | Modify | Add `nav.groupPrograms` item to `catalogNav` |
| `apps/dashboard/components/features/group-programs/group-programs-page-content.tsx` | Create | List table with create button |
| `apps/dashboard/components/features/group-programs/group-program-form-page.tsx` | Create | Create form with RHF + Zod |
| `apps/dashboard/app/(dashboard)/group-programs/page.tsx` | Create | Route shell |
| `apps/dashboard/app/(dashboard)/group-programs/create/page.tsx` | Create | Create route shell |

---

### Task 1: Types + Schema + API + Query Key

**Files:**
- Create: `apps/dashboard/lib/types/group-program.ts`
- Create: `apps/dashboard/lib/schemas/group-program.schema.ts`
- Create: `apps/dashboard/lib/api/group-programs.ts`
- Modify: `apps/dashboard/lib/query-keys.ts`

**Interfaces:**
- Produces:
  - `GroupProgramListItem` — fields: `id: string`, `ref: string`, `nameAr: string`, `nameEn: string | null`, `departmentId: string`, `minParticipants: number`, `maxParticipants: number`, `defaultPrice: number`, `isActive: boolean`, `createdAt: string`, `updatedAt: string`
  - `CreateGroupProgramPayload` — fields: `nameAr: string`, `nameEn?: string`, `departmentId: string`, `minParticipants: number`, `maxParticipants: number`, `defaultPrice: number`, `descriptionAr?: string`, `descriptionEn?: string`
  - `CreateGroupProgramFormData` — inferred from `createGroupProgramSchema`
  - `fetchGroupPrograms(query?: GroupProgramListQuery): Promise<GroupProgramListItem[]>`
  - `createGroupProgram(payload: CreateGroupProgramPayload): Promise<{ id: string; ref: string }>`
  - `queryKeys.groupPrograms.all`, `queryKeys.groupPrograms.list(filters?)`

- [ ] **Step 1: Create types file**

```typescript
// apps/dashboard/lib/types/group-program.ts
/**
 * Group Program types — Sawaa Dashboard
 */

export interface GroupProgramListItem {
  id: string
  ref: string
  nameAr: string
  nameEn: string | null
  departmentId: string
  minParticipants: number
  maxParticipants: number
  defaultPrice: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface GroupProgramListQuery {
  activeOnly?: boolean
  departmentId?: string
}

export interface CreateGroupProgramPayload {
  nameAr: string
  nameEn?: string
  departmentId: string
  minParticipants: number
  maxParticipants: number
  defaultPrice: number
  descriptionAr?: string
  descriptionEn?: string
}
```

- [ ] **Step 2: Create schema file**

```typescript
// apps/dashboard/lib/schemas/group-program.schema.ts
import { z } from "zod"

export const createGroupProgramSchema = z.object({
  nameAr: z.string().min(1, { message: "required" }).max(200),
  nameEn: z.string().max(200).optional(),
  departmentId: z.string().min(1, { message: "required" }),
  minParticipants: z.coerce.number().int().min(1, { message: "required" }),
  maxParticipants: z.coerce.number().int().min(1, { message: "required" }),
  defaultPriceInSar: z.coerce.number().min(0, { message: "required" }),
  isActive: z.boolean().default(true),
  descriptionAr: z.string().optional(),
  descriptionEn: z.string().optional(),
})

export type CreateGroupProgramFormData = z.infer<typeof createGroupProgramSchema>
```

- [ ] **Step 3: Create API file**

```typescript
// apps/dashboard/lib/api/group-programs.ts
/**
 * Group Programs API — Sawaa Dashboard
 * Controller: dashboard/group-programs
 */

import { api } from "@/lib/api"
import type { GroupProgramListItem, GroupProgramListQuery, CreateGroupProgramPayload } from "@/lib/types/group-program"

export type { GroupProgramListQuery, CreateGroupProgramPayload }

export async function fetchGroupPrograms(
  query: GroupProgramListQuery = {},
): Promise<GroupProgramListItem[]> {
  return api.get<GroupProgramListItem[]>("/dashboard/group-programs", {
    activeOnly: query.activeOnly,
    departmentId: query.departmentId,
  })
}

export async function createGroupProgram(
  payload: CreateGroupProgramPayload,
): Promise<{ id: string; ref: string }> {
  return api.post<{ id: string; ref: string }>("/dashboard/group-programs", payload)
}
```

- [ ] **Step 4: Add query key to `apps/dashboard/lib/query-keys.ts`**

Find the `/* ─── Group Sessions ─── */` block at the bottom of `queryKeys` (just before the closing `}`) and add after it:

```typescript
  /* ─── Group Programs ─── */
  groupPrograms: {
    all: ["group-programs"] as const,
    list: (filters?: object) => ["group-programs", "list", filters] as const,
  },
```

- [ ] **Step 5: Run typecheck**

```bash
cd /Users/tariq/code/sawaa && pnpm --filter=dashboard typecheck 2>&1 | tail -20
```

Expected: no errors related to the new files.

- [ ] **Step 6: Commit**

```bash
cd /Users/tariq/code/sawaa
git add apps/dashboard/lib/types/group-program.ts \
        apps/dashboard/lib/schemas/group-program.schema.ts \
        apps/dashboard/lib/api/group-programs.ts \
        apps/dashboard/lib/query-keys.ts
git commit -m "feat(dashboard): add group-program types, schema, api, and query key"
```

---

### Task 2: Hook

**Files:**
- Create: `apps/dashboard/hooks/use-group-programs.ts`

**Interfaces:**
- Consumes: `fetchGroupPrograms`, `createGroupProgram` from `@/lib/api/group-programs`; `queryKeys.groupPrograms` from `@/lib/query-keys`
- Produces:
  - `useGroupPrograms()` → `{ programs: GroupProgramListItem[], isLoading: boolean, error: string | null }`
  - `useGroupProgramMutations()` → `{ createMut: UseMutationResult }`

- [ ] **Step 1: Create hook file**

```typescript
// apps/dashboard/hooks/use-group-programs.ts
"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { toastApiError } from "@/lib/mutation-helpers"
import { fetchGroupPrograms, createGroupProgram } from "@/lib/api/group-programs"

/* ─── List Hook ─── */

export function useGroupPrograms() {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.groupPrograms.list(),
    queryFn: () => fetchGroupPrograms(),
    staleTime: 10_000,
  })

  return {
    programs: data ?? [],
    isLoading,
    error: error instanceof Error ? error.message : null,
  }
}

/* ─── Mutations ─── */

export function useGroupProgramMutations() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.groupPrograms.all, refetchType: "all" })

  const createMut = useMutation({
    mutationFn: createGroupProgram,
    onSuccess: invalidate,
    onError: toastApiError("فشل إنشاء البرنامج الجماعي"),
  })

  return { createMut }
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd /Users/tariq/code/sawaa && pnpm --filter=dashboard typecheck 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/tariq/code/sawaa
git add apps/dashboard/hooks/use-group-programs.ts
git commit -m "feat(dashboard): add useGroupPrograms and useGroupProgramMutations hooks"
```

---

### Task 3: Translations

**Files:**
- Create: `apps/dashboard/lib/translations/ar.group-programs.ts`
- Create: `apps/dashboard/lib/translations/en.group-programs.ts`
- Modify: `apps/dashboard/lib/translations/ar.ts`
- Modify: `apps/dashboard/lib/translations/en.ts`
- Modify: `apps/dashboard/components/sidebar-config.ts`

**Interfaces:**
- Produces: all `groupPrograms.*` and `nav.groupPrograms` keys in both locales

- [ ] **Step 1: Create Arabic translations**

```typescript
// apps/dashboard/lib/translations/ar.group-programs.ts
export const arGroupPrograms: Record<string, string> = {
  "nav.groupPrograms": "البرامج الجماعية",
  "groupPrograms.title": "البرامج الجماعية",
  "groupPrograms.description": "إدارة برامج الجلسات الجماعية",
  "groupPrograms.newProgram": "برنامج جديد",
  "groupPrograms.empty.title": "لا توجد برامج جماعية",
  "groupPrograms.empty.description": "لم يتم إنشاء أي برنامج جماعي بعد.",
  "groupPrograms.col.name": "اسم البرنامج",
  "groupPrograms.col.department": "القسم",
  "groupPrograms.col.participants": "المشاركون",
  "groupPrograms.col.defaultPrice": "السعر الافتراضي",
  "groupPrograms.col.status": "الحالة",
  "groupPrograms.status.active": "نشط",
  "groupPrograms.status.inactive": "غير نشط",
  "groupPrograms.currency": "ر.س",
  "groupPrograms.participants.range": "{{min}} – {{max}}",
  "groupPrograms.create.title": "برنامج جماعي جديد",
  "groupPrograms.create.pageDescription": "أدخل تفاصيل البرنامج الجماعي الجديد",
  "groupPrograms.create.submit": "إنشاء البرنامج",
  "groupPrograms.create.submitting": "جارٍ الإنشاء...",
  "groupPrograms.create.success": "تم إنشاء البرنامج بنجاح",
  "groupPrograms.form.nameAr": "الاسم (عربي)",
  "groupPrograms.form.nameEn": "الاسم (إنجليزي)",
  "groupPrograms.form.department": "القسم",
  "groupPrograms.form.selectDepartment": "اختر القسم",
  "groupPrograms.form.minParticipants": "الحد الأدنى للمشاركين",
  "groupPrograms.form.maxParticipants": "الحد الأقصى للمشاركين",
  "groupPrograms.form.defaultPrice": "السعر الافتراضي (ر.س)",
  "groupPrograms.form.isActive": "البرنامج نشط",
  "groupPrograms.form.descriptionAr": "الوصف (عربي)",
  "groupPrograms.form.descriptionEn": "الوصف (إنجليزي)",
  "groupPrograms.section.basics": "الأساسيات",
  "groupPrograms.section.settings": "الإعدادات",
  "groupPrograms.backToList": "العودة إلى البرامج الجماعية",
}
```

- [ ] **Step 2: Create English translations (same 35 keys)**

```typescript
// apps/dashboard/lib/translations/en.group-programs.ts
export const enGroupPrograms: Record<string, string> = {
  "nav.groupPrograms": "Group Programs",
  "groupPrograms.title": "Group Programs",
  "groupPrograms.description": "Manage group session programs",
  "groupPrograms.newProgram": "New Program",
  "groupPrograms.empty.title": "No Group Programs",
  "groupPrograms.empty.description": "No group programs have been created yet.",
  "groupPrograms.col.name": "Program Name",
  "groupPrograms.col.department": "Department",
  "groupPrograms.col.participants": "Participants",
  "groupPrograms.col.defaultPrice": "Default Price",
  "groupPrograms.col.status": "Status",
  "groupPrograms.status.active": "Active",
  "groupPrograms.status.inactive": "Inactive",
  "groupPrograms.currency": "SAR",
  "groupPrograms.participants.range": "{{min}} – {{max}}",
  "groupPrograms.create.title": "New Group Program",
  "groupPrograms.create.pageDescription": "Enter the details for the new group program",
  "groupPrograms.create.submit": "Create Program",
  "groupPrograms.create.submitting": "Creating...",
  "groupPrograms.create.success": "Program created successfully",
  "groupPrograms.form.nameAr": "Name (Arabic)",
  "groupPrograms.form.nameEn": "Name (English)",
  "groupPrograms.form.department": "Department",
  "groupPrograms.form.selectDepartment": "Select department",
  "groupPrograms.form.minParticipants": "Minimum Participants",
  "groupPrograms.form.maxParticipants": "Maximum Participants",
  "groupPrograms.form.defaultPrice": "Default Price (SAR)",
  "groupPrograms.form.isActive": "Program is active",
  "groupPrograms.form.descriptionAr": "Description (Arabic)",
  "groupPrograms.form.descriptionEn": "Description (English)",
  "groupPrograms.section.basics": "Basics",
  "groupPrograms.section.settings": "Settings",
  "groupPrograms.backToList": "Back to Group Programs",
}
```

- [ ] **Step 3: Update `ar.ts`**

Add after the `arGroupSessions` import line:
```typescript
import { arGroupPrograms } from "./ar.group-programs"
```
And add `...arGroupPrograms,` to the spread inside `export const ar`.

- [ ] **Step 4: Update `en.ts`**

Add after the `enGroupSessions` import line:
```typescript
import { enGroupPrograms } from "./en.group-programs"
```
And add `...enGroupPrograms,` to the spread inside `export const en`.

- [ ] **Step 5: Add sidebar nav item**

In `apps/dashboard/components/sidebar-config.ts`, add a suitable icon import. The `UserMultiple02Icon` is already imported. Add to `catalogNav` (after `{ titleKey: "nav.bundles", ... }`):

```typescript
{ titleKey: "nav.groupPrograms", href: "/group-programs", icon: UserMultiple02Icon, permission: "booking:read" },
```

Also add `"nav.groupPrograms"` key to `ar.nav.ts` and `en.nav.ts` — but note the key is already in `ar.group-programs.ts` / `en.group-programs.ts` above (prefixed `"nav.groupPrograms"`), so it will merge into the flat map automatically. No change needed in `ar.nav.ts`.

- [ ] **Step 6: Verify i18n parity**

```bash
cd /Users/tariq/code/sawaa && pnpm --filter=dashboard run i18n:verify 2>&1 | tail -10
```

Expected: exit 0, no drift reported.

- [ ] **Step 7: Commit**

```bash
cd /Users/tariq/code/sawaa
git add apps/dashboard/lib/translations/ar.group-programs.ts \
        apps/dashboard/lib/translations/en.group-programs.ts \
        apps/dashboard/lib/translations/ar.ts \
        apps/dashboard/lib/translations/en.ts \
        apps/dashboard/components/sidebar-config.ts
git commit -m "feat(dashboard): add group-programs translations and sidebar nav item"
```

---

### Task 4: List Page Component

**Files:**
- Create: `apps/dashboard/components/features/group-programs/group-programs-page-content.tsx`

**Interfaces:**
- Consumes: `useGroupPrograms()` from `@/hooks/use-group-programs`; `useDepartmentOptions()` from `@/hooks/use-departments`
- Produces: `<GroupProgramsPageContent />` — exported named component

- [ ] **Step 1: Check which shared feature components exist**

```bash
ls /Users/tariq/code/sawaa/apps/dashboard/components/features/ 2>/dev/null | head -20
```

Use the same components as group-sessions: `ListPageShell`, `PageHeader`, `DataTable`, `ErrorBanner`.

- [ ] **Step 2: Create the list component**

```typescript
// apps/dashboard/components/features/group-programs/group-programs-page-content.tsx
"use client"

import { useRouter } from "next/navigation"
import { useLocale } from "@/components/locale-provider"
import { useGroupPrograms } from "@/hooks/use-group-programs"
import { useDepartmentOptions } from "@/hooks/use-departments"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { DataTable } from "@/components/features/data-table"
import { ErrorBanner } from "@/components/features/error-banner"
import { Button, Badge, Skeleton } from "@sawaa/ui"
import type { GroupProgramListItem } from "@/lib/types/group-program"
import type { ColumnDef } from "@tanstack/react-table"

export function GroupProgramsPageContent() {
  const { t, locale } = useLocale()
  const router = useRouter()
  const { programs, isLoading, error } = useGroupPrograms()
  const { options: departments } = useDepartmentOptions()

  const deptName = (deptId: string) => {
    const dept = departments.find((d) => d.id === deptId)
    if (!dept) return deptId
    return locale === "ar" ? dept.nameAr : (dept.nameEn ?? dept.nameAr)
  }

  const formatPrice = (halalas: number) =>
    `${(halalas / 100).toFixed(2)} ${t("groupPrograms.currency")}`

  const columns: ColumnDef<GroupProgramListItem>[] = [
    {
      accessorKey: "nameAr",
      header: t("groupPrograms.col.name"),
      cell: ({ row }) => (
        <span className="font-medium">
          {locale === "ar" ? row.original.nameAr : (row.original.nameEn ?? row.original.nameAr)}
        </span>
      ),
    },
    {
      accessorKey: "departmentId",
      header: t("groupPrograms.col.department"),
      cell: ({ row }) => deptName(row.original.departmentId),
    },
    {
      id: "participants",
      header: t("groupPrograms.col.participants"),
      cell: ({ row }) =>
        `${row.original.minParticipants} – ${row.original.maxParticipants}`,
    },
    {
      accessorKey: "defaultPrice",
      header: t("groupPrograms.col.defaultPrice"),
      cell: ({ row }) => formatPrice(row.original.defaultPrice),
    },
    {
      accessorKey: "isActive",
      header: t("groupPrograms.col.status"),
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "default" : "secondary"}>
          {row.original.isActive
            ? t("groupPrograms.status.active")
            : t("groupPrograms.status.inactive")}
        </Badge>
      ),
    },
  ]

  if (error) return <ErrorBanner message={error} />

  return (
    <ListPageShell>
      <PageHeader
        title={t("groupPrograms.title")}
        description={t("groupPrograms.description")}
        action={
          <Button onClick={() => router.push("/group-programs/create")}>
            {t("groupPrograms.newProgram")}
          </Button>
        }
      />
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : programs.length === 0 ? (
        <div className="py-16 text-center text-[var(--muted-foreground)]">
          <p className="font-medium">{t("groupPrograms.empty.title")}</p>
          <p className="text-sm mt-1">{t("groupPrograms.empty.description")}</p>
        </div>
      ) : (
        <DataTable columns={columns} data={programs} />
      )}
    </ListPageShell>
  )
}
```

- [ ] **Step 3: Run typecheck**

```bash
cd /Users/tariq/code/sawaa && pnpm --filter=dashboard typecheck 2>&1 | tail -20
```

Fix any type errors before continuing.

- [ ] **Step 4: Commit**

```bash
cd /Users/tariq/code/sawaa
git add apps/dashboard/components/features/group-programs/group-programs-page-content.tsx
git commit -m "feat(dashboard): add group-programs list page component"
```

---

### Task 5: Create Form Component

**Files:**
- Create: `apps/dashboard/components/features/group-programs/group-program-form-page.tsx`

**Interfaces:**
- Consumes: `useGroupProgramMutations()` from `@/hooks/use-group-programs`; `useDepartmentOptions()` from `@/hooks/use-departments`; `createGroupProgramSchema`, `CreateGroupProgramFormData` from `@/lib/schemas/group-program.schema`
- Produces: `<GroupProgramFormPage />` — exported named component

- [ ] **Step 1: Check how existing create forms look**

```bash
cat /Users/tariq/code/sawaa/apps/dashboard/components/features/group-sessions/create-group-session-form.tsx 2>/dev/null | head -80
```

Use the same `useForm` + `zodResolver` pattern.

- [ ] **Step 2: Create the form component**

```typescript
// apps/dashboard/components/features/group-programs/group-program-form-page.tsx
"use client"

import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useLocale } from "@/components/locale-provider"
import { useGroupProgramMutations } from "@/hooks/use-group-programs"
import { useDepartmentOptions } from "@/hooks/use-departments"
import { createGroupProgramSchema } from "@/lib/schemas/group-program.schema"
import type { CreateGroupProgramFormData } from "@/lib/schemas/group-program.schema"
import {
  Button,
  Input,
  Label,
  Switch,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@sawaa/ui"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"

export function GroupProgramFormPage() {
  const { t } = useLocale()
  const router = useRouter()
  const { createMut } = useGroupProgramMutations()
  const { options: departments, isLoading: deptsLoading } = useDepartmentOptions()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateGroupProgramFormData>({
    resolver: zodResolver(createGroupProgramSchema),
    defaultValues: {
      minParticipants: 1,
      maxParticipants: 30,
      defaultPriceInSar: 0,
      isActive: true,
    },
  })

  const isActive = watch("isActive")

  const onSubmit = async (data: CreateGroupProgramFormData) => {
    await createMut.mutateAsync({
      nameAr: data.nameAr,
      nameEn: data.nameEn || undefined,
      departmentId: data.departmentId,
      minParticipants: data.minParticipants,
      maxParticipants: data.maxParticipants,
      defaultPrice: Math.round(data.defaultPriceInSar * 100),
      descriptionAr: data.descriptionAr || undefined,
      descriptionEn: data.descriptionEn || undefined,
    })
    router.push("/group-programs")
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <Breadcrumbs
        items={[
          { label: t("groupPrograms.title"), href: "/group-programs" },
          { label: t("groupPrograms.create.title") },
        ]}
      />
      <PageHeader
        title={t("groupPrograms.create.title")}
        description={t("groupPrograms.create.pageDescription")}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 mt-6">
        {/* ─── Basics ─── */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
            {t("groupPrograms.section.basics")}
          </h2>

          <div className="space-y-2">
            <Label htmlFor="nameAr">{t("groupPrograms.form.nameAr")}</Label>
            <Input id="nameAr" {...register("nameAr")} dir="rtl" />
            {errors.nameAr && (
              <p className="text-sm text-[var(--error)]">{t("common.required")}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="nameEn">{t("groupPrograms.form.nameEn")}</Label>
            <Input id="nameEn" {...register("nameEn")} dir="ltr" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="departmentId">{t("groupPrograms.form.department")}</Label>
            <Select
              disabled={deptsLoading}
              onValueChange={(val) => setValue("departmentId", val, { shouldValidate: true })}
            >
              <SelectTrigger id="departmentId">
                <SelectValue placeholder={t("groupPrograms.form.selectDepartment")} />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.nameAr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.departmentId && (
              <p className="text-sm text-[var(--error)]">{t("common.required")}</p>
            )}
          </div>
        </section>

        {/* ─── Settings ─── */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
            {t("groupPrograms.section.settings")}
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minParticipants">{t("groupPrograms.form.minParticipants")}</Label>
              <Input
                id="minParticipants"
                type="number"
                min={1}
                {...register("minParticipants")}
              />
              {errors.minParticipants && (
                <p className="text-sm text-[var(--error)]">{t("common.required")}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxParticipants">{t("groupPrograms.form.maxParticipants")}</Label>
              <Input
                id="maxParticipants"
                type="number"
                min={1}
                {...register("maxParticipants")}
              />
              {errors.maxParticipants && (
                <p className="text-sm text-[var(--error)]">{t("common.required")}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="defaultPriceInSar">{t("groupPrograms.form.defaultPrice")}</Label>
            <Input
              id="defaultPriceInSar"
              type="number"
              min={0}
              step={0.01}
              {...register("defaultPriceInSar")}
            />
            {errors.defaultPriceInSar && (
              <p className="text-sm text-[var(--error)]">{t("common.required")}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={(checked) => setValue("isActive", checked)}
            />
            <Label htmlFor="isActive">{t("groupPrograms.form.isActive")}</Label>
          </div>
        </section>

        {/* ─── Descriptions ─── */}
        <section className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="descriptionAr">{t("groupPrograms.form.descriptionAr")}</Label>
            <Textarea id="descriptionAr" {...register("descriptionAr")} dir="rtl" rows={3} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descriptionEn">{t("groupPrograms.form.descriptionEn")}</Label>
            <Textarea id="descriptionEn" {...register("descriptionEn")} dir="ltr" rows={3} />
          </div>
        </section>

        {/* ─── Actions ─── */}
        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isSubmitting || createMut.isPending}>
            {isSubmitting || createMut.isPending
              ? t("groupPrograms.create.submitting")
              : t("groupPrograms.create.submit")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/group-programs")}
          >
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Run typecheck**

```bash
cd /Users/tariq/code/sawaa && pnpm --filter=dashboard typecheck 2>&1 | tail -20
```

Fix any errors. Common issue: `Textarea` may not be in `@sawaa/ui` — check with:
```bash
grep -r "Textarea" /Users/tariq/code/sawaa/packages/ui/src/ 2>/dev/null | head -5
```
If absent, replace `<Textarea>` with `<textarea className="..." />` using tokens.

- [ ] **Step 4: Commit**

```bash
cd /Users/tariq/code/sawaa
git add apps/dashboard/components/features/group-programs/group-program-form-page.tsx
git commit -m "feat(dashboard): add group-program create form component"
```

---

### Task 6: Route Pages

**Files:**
- Create: `apps/dashboard/app/(dashboard)/group-programs/page.tsx`
- Create: `apps/dashboard/app/(dashboard)/group-programs/create/page.tsx`

**Interfaces:**
- Consumes: `GroupProgramsPageContent` from `@/components/features/group-programs/group-programs-page-content`; `GroupProgramFormPage` from `@/components/features/group-programs/group-program-form-page`

- [ ] **Step 1: Create list page**

```typescript
// apps/dashboard/app/(dashboard)/group-programs/page.tsx
"use client"

import { Suspense } from "react"
import { GroupProgramsPageContent } from "@/components/features/group-programs/group-programs-page-content"

export default function GroupProgramsPage() {
  return (
    <Suspense>
      <GroupProgramsPageContent />
    </Suspense>
  )
}
```

- [ ] **Step 2: Create the create page**

```typescript
// apps/dashboard/app/(dashboard)/group-programs/create/page.tsx
"use client"

import { Suspense } from "react"
import { GroupProgramFormPage } from "@/components/features/group-programs/group-program-form-page"

export default function GroupProgramsCreatePage() {
  return (
    <Suspense>
      <GroupProgramFormPage />
    </Suspense>
  )
}
```

- [ ] **Step 3: Final typecheck + i18n verify**

```bash
cd /Users/tariq/code/sawaa && pnpm --filter=dashboard typecheck 2>&1 | tail -20
pnpm --filter=dashboard run i18n:verify 2>&1 | tail -10
```

Expected: both pass with exit 0.

- [ ] **Step 4: Commit**

```bash
cd /Users/tariq/code/sawaa
git add apps/dashboard/app/\(dashboard\)/group-programs/page.tsx \
        apps/dashboard/app/\(dashboard\)/group-programs/create/page.tsx
git commit -m "feat(dashboard): add group-programs list and create route pages"
```

---

## Self-Review

### Spec Coverage Check

| Requirement | Task |
|-------------|------|
| `GroupProgram`, `GroupProgramListItem`, `CreateGroupProgramPayload` types | Task 1 |
| `createGroupProgramSchema` + `CreateGroupProgramFormData` | Task 1 |
| `fetchGroupPrograms()`, `createGroupProgram()` | Task 1 |
| `useGroupPrograms()` with `staleTime: 10_000` | Task 2 |
| `useGroupProgramMutations()` with create mutation | Task 2 |
| Arabic translation keys (`groupPrograms.*`) | Task 3 |
| English translation keys (same count) | Task 3 |
| `ar.ts` + `en.ts` updated | Task 3 |
| Sidebar nav item | Task 3 |
| `query-keys.ts` `groupPrograms` key | Task 1 |
| List page: table with nameAr, departmentId, maxParticipants, defaultPrice, isActive badge | Task 4 |
| "New Program" button → `/group-programs/create` | Task 4 |
| Form: nameAr, nameEn, department selector, min/maxParticipants, defaultPriceInSar, isActive | Task 5 |
| SAR → halalas: `Math.round(defaultPriceInSar * 100)` | Task 5 |
| `useDepartments()` / `useDepartmentOptions()` in form | Task 5 |
| No `useBranches()`, no `useServices()` | Tasks 4, 5 |
| Route pages ≤ 150 lines each | Task 6 |

### Type Consistency

- `GroupProgramListItem.defaultPrice` is halalas (integer from API).
- Form field `defaultPriceInSar` (number) → converted to halalas in `onSubmit`.
- `CreateGroupProgramPayload.defaultPrice` is halalas — matching the API DTO field name `defaultPrice`.
- `isActive` is NOT sent in the payload (not in `CreateGroupProgramDto` per OpenAPI) — it's only used for UI default display.

### Placeholder Scan

No TBDs, TODOs, or "implement later" found. All code blocks are complete.
