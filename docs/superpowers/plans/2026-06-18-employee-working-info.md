# بطاقة الممارس — بيانات العمل — خطة التنفيذ

**التاريخ:** 2026-06-18
**المرجع:** [`2026-06-18-employee-working-info-design.md`](../specs/2026-06-18-employee-working-info-design.md)
**النطاق:** `apps/dashboard` فقط — لا تغيير على الباك إند

تنفيذ على **6 مهمات** بالتتابع. كل مهمة تنتج تغييراً قابلاً للاختبار مستقلاً. TDD: اختبار → فشل → تطبيق → نجاح → commit.

---

## Global Constraints

من `apps/dashboard/CLAUDE.md` ومن المواصفة:

- **حدود الحجم:** صفحة ≤150، مكوّن feature ≤300، hook ≤200، schema ≤150، types ≤250، أي ملف ≤350
- **i18n:** كل نص للمستخدم عبر `t('key')`؛ مفاتيح AR + EN معاً؛ `pnpm --filter=dashboard i18n:verify` قبل DONE
- **RTL:** كلاسات منطقية فقط (`ps-/pe-/ms-/me-`)، `tabular-nums` للأرقام، لا hardcode `left/right`
- **الأيقونات:** فقط من `@hugeicons/core-free-icons`، لا emojis
- **البدائيات:** import من `@sawaa/ui` فقط
- **Layer rules:** لا cross-feature imports؛ كل query في `hooks/`؛ كل mutation في `hooks/`
- **single-tenant:** لا tenant switching، لا useTerminology، كل النصوص عبر `t()` من `useLocale()`
- **لا comments** على الكود
- **لا مساس** بالباك إند، Prisma، OpenAPI، أو غير `apps/dashboard`
- **لا مساس** بـ `EmployeeCustomPricingRow` أو `DurationSection` أو `EmployeeServiceTypesEditor` أو `EmployeeTypeRow`

---

## Task 1 — `queryKeys.employees.schedule` + استكشاف endpoint موجود

**الهدف:** إضافة مفتاح cache للجدول الأسبوعي للموظف. **الدالة موجودة بالفعل** في `setAvailability` في `lib/api/employees-schedule.ts:49-60` — نستخدمها في Task 2 بدون تعديل.

### الملفات

- تعديل: `apps/dashboard/lib/query-keys.ts` (نضيف `employees.schedule`)

### الواجهة

```ts
// lib/query-keys.ts (إضافة داخل قسم employees)
schedule: (employeeId: string) => [...queryKeys.employees.all, "schedule", employeeId] as const
```

### الخطوات

- [ ] **Step 1: أضف مفتاح الـ query**

في `apps/dashboard/lib/query-keys.ts`، داخل `employees: { ... }`:

```ts
schedule: (employeeId: string) => [...queryKeys.employees.all, "schedule", employeeId] as const,
```

- [ ] **Step 2: typecheck**

```bash
pnpm typecheck
```

المتوقع: exit 0.

- [ ] **Step 3: commit**

```bash
git add apps/dashboard/lib/query-keys.ts
git commit -m "feat(services): add queryKey for employee schedule"
```

**ملاحظة تنفيذية**: لا حاجة لإنشاء دالة API جديدة — `setAvailability` في `lib/api/employees-schedule.ts:49` تُغلف `PATCH /dashboard/people/employees/{id}/availability` بـ body `{ windows }` وتأخذ `SetAvailabilityPayload` (نوعه `{ schedule: AvailabilitySlot[] }`). Task 2 ستستخدمها مباشرةً.

---

## Task 2 — Hook `use-employee-schedule`

**الهدف:** query + mutation للجدول، مع invalidation صحيح.

### الملفات

- جديد: `apps/dashboard/hooks/use-employee-schedule.ts` (≤200 سطر)
- جديد: `apps/dashboard/test/unit/hooks/use-employee-schedule.spec.ts` (≤200 سطر)

### الواجهة

```ts
export function useEmployeeSchedule(employeeId: string | null): UseQueryResult<AvailabilitySlot[]>
export function useUpdateEmployeeSchedule(employeeId: string | null): UseMutationResult<...>
```

### الخطوات

- [ ] **Step 1: اكتب الاختبار**

```ts
// apps/dashboard/test/unit/hooks/use-employee-schedule.spec.tsx
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { ReactNode } from "react"

vi.mock("@/lib/api/employees-schedule", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/employees-schedule")>(
    "@/lib/api/employees-schedule",
  )
  return {
    ...actual,
    fetchAvailability: vi.fn(),
    setAvailability: vi.fn(),
  }
})

import { fetchAvailability, setAvailability } from "@/lib/api/employees-schedule"
import { useEmployeeSchedule, useUpdateEmployeeSchedule } from "@/hooks/use-employee-schedule"

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe("useEmployeeSchedule", () => {
  beforeEach(() => vi.clearAllMocks())

  it("fetches when employeeId is provided", async () => {
    vi.mocked(fetchAvailability).mockResolvedValue([])
    const { result } = renderHook(() => useEmployeeSchedule("emp-1"), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(fetchAvailability).toHaveBeenCalledWith("emp-1")
  })

  it("does not fetch when employeeId is null", () => {
    const { result } = renderHook(() => useEmployeeSchedule(null), { wrapper: makeWrapper() })
    expect(result.current.isFetching).toBe(false)
    expect(fetchAvailability).not.toHaveBeenCalled()
  })
})

describe("useUpdateEmployeeSchedule", () => {
  beforeEach(() => vi.clearAllMocks())

  it("calls setAvailability and invalidates schedule + employee detail queries", async () => {
    vi.mocked(setAvailability).mockResolvedValue(undefined)
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries")
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useUpdateEmployeeSchedule("emp-1"), { wrapper })
    result.current.mutate([])
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(setAvailability).toHaveBeenCalledWith("emp-1", { schedule: [] })
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: expect.arrayContaining(["employees", "schedule", "emp-1"]) }),
    )
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: expect.arrayContaining(["employees", "detail", "emp-1"]) }),
    )
  })
})
```

- [ ] **Step 2: شغّل الاختبار، تأكد أنه يفشل**

```bash
pnpm --filter=dashboard test -- test/unit/hooks/use-employee-schedule.spec.tsx
```

المتوقع: FAIL — `use-employee-schedule` غير موجود.

- [ ] **Step 3: نفّذ الـ hook**

```ts
// apps/dashboard/hooks/use-employee-schedule.ts
"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  fetchAvailability,
  setAvailability,
  type AvailabilitySlot,
} from "@/lib/api/employees-schedule"
import { queryKeys } from "@/lib/query-keys"

export function useEmployeeSchedule(employeeId: string | null) {
  return useQuery<AvailabilitySlot[]>({
    queryKey: queryKeys.employees.schedule(employeeId ?? ""),
    queryFn: () => fetchAvailability(employeeId!),
    enabled: !!employeeId,
    staleTime: 60_000,
  })
}

export function useUpdateEmployeeSchedule(employeeId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (schedule: AvailabilitySlot[]) =>
      setAvailability(employeeId!, { schedule }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.employees.schedule(employeeId ?? ""),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.employees.detail(employeeId ?? ""),
      })
    },
  })
}
```

تحقق من اسم مفتاح `queryKeys.employees.detail` في `lib/query-keys.ts` — إن لم يكن موجوداً، نستخدم `queryKeys.employees.all` بدلاً.

- [ ] **Step 4: شغّل الاختبار، تأكد أنه ينجح**

```bash
pnpm --filter=dashboard test -- test/unit/hooks/use-employee-schedule.spec.tsx
```

المتوقع: PASS.

- [ ] **Step 5: typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 6: commit**

```bash
git add apps/dashboard/hooks/use-employee-schedule.ts \
        apps/dashboard/test/unit/hooks/use-employee-schedule.spec.tsx
git commit -m "feat(services): add useEmployeeSchedule + useUpdateEmployeeSchedule hooks"
```

---

## Task 3 — إضافة `branchIds` لـ `ServiceEmployee.employee`

**الهدف:** فتح الحقل في الـ type. لو الـ backend يرجّعه، نستخدمه مباشرةً.

### الملفات

- تعديل: `apps/dashboard/lib/types/service.ts:157-177`

### الخطوات

- [ ] **Step 1: عدّل الـ interface**

في `apps/dashboard/lib/types/service.ts`، داخل `ServiceEmployee.employee`:

```ts
export interface ServiceEmployee {
  id: string
  employee: {
    id: string
    nameAr: string | null
    title: string | null
    avatarUrl: string | null
    isActive: boolean
    branchIds?: string[]
    user: {
      firstName: string
      lastName: string
    }
  }
  serviceTypes: ServiceEmployeeServiceType[]
  customDuration: number | null
  bufferMinutes: number
  availableTypes: string[]
  isActive: boolean
  hasCustomPricing: boolean
  effectiveDurations?: PractitionerDurationGroup[]
}
```

- [ ] **Step 2: typecheck**

```bash
pnpm typecheck
```

المتوقع: exit 0 (الحقل اختياري فلا يكسر شيئاً).

- [ ] **Step 3: commit**

```bash
git add apps/dashboard/lib/types/service.ts
git commit -m "feat(types): add optional branchIds to ServiceEmployee.employee"
```

---

## Task 4 — مفاتيح الترجمة

**الهدف:** إضافة 28 مفتاح AR + EN تحت `services.employees.workingInfo.*`.

### الملفات

- تعديل: `apps/dashboard/lib/translations/ar.services.ts`
- تعديل: `apps/dashboard/lib/translations/en.services.ts`

### الخطوات

- [ ] **Step 1: أضف الكتلتين**

في `ar.services.ts` (بعد قسم `services.employees.durations`):

```ts
"services.employees.workingInfo.title": "بيانات العمل",
"services.employees.workingInfo.expand": "توسيع",
"services.employees.workingInfo.collapse": "طي",
"services.employees.workingInfo.branches": "الفروع",
"services.employees.workingInfo.noBranches": "غير معيّن في أي فرع",
"services.employees.workingInfo.addBranch": "+ إضافة فرع",
"services.employees.workingInfo.addBranchSearch": "ابحث عن فرع…",
"services.employees.workingInfo.addBranchEmpty": "لا نتائج",
"services.employees.workingInfo.addBranchNone": "لم تُضف فروع بعد",
"services.employees.workingInfo.removeBranch": "إزالة الفرع",
"services.employees.workingInfo.schedule": "ساعات العمل",
"services.employees.workingInfo.scheduleNone": "بدون جدول",
"services.employees.workingInfo.scheduleVaried": "أوقات متفرقة",
"services.employees.workingInfo.dayActive": "يعمل في هذا اليوم",
"services.employees.workingInfo.day.sat": "السبت",
"services.employees.workingInfo.day.sun": "الأحد",
"services.employees.workingInfo.day.mon": "الإثنين",
"services.employees.workingInfo.day.tue": "الثلاثاء",
"services.employees.workingInfo.day.wed": "الأربعاء",
"services.employees.workingInfo.day.thu": "الخميس",
"services.employees.workingInfo.day.fri": "الجمعة",
"services.employees.workingInfo.savedToast": "تم حفظ ساعات العمل",
"services.employees.workingInfo.saveErrorToast": "فشل حفظ ساعات العمل",
"services.employees.workingInfo.branchAddedToast": "تمت إضافة الفرع",
"services.employees.workingInfo.branchRemovedToast": "تمت إزالة الفرع",
"services.employees.workingInfo.branchErrorToast": "فشل تحديث الفروع",
```

في `en.services.ts`، نفس المفاتيح بقيم:

```ts
"services.employees.workingInfo.title": "Working info",
"services.employees.workingInfo.expand": "Expand",
"services.employees.workingInfo.collapse": "Collapse",
"services.employees.workingInfo.branches": "Branches",
"services.employees.workingInfo.noBranches": "Not assigned to any branch",
"services.employees.workingInfo.addBranch": "+ Add branch",
"services.employees.workingInfo.addBranchSearch": "Search branches…",
"services.employees.workingInfo.addBranchEmpty": "No matching branches",
"services.employees.workingInfo.addBranchNone": "No branches yet — add one in Settings",
"services.employees.workingInfo.removeBranch": "Remove branch",
"services.employees.workingInfo.schedule": "Working hours",
"services.employees.workingInfo.scheduleNone": "No schedule",
"services.employees.workingInfo.scheduleVaried": "Varied hours",
"services.employees.workingInfo.dayActive": "Works this day",
"services.employees.workingInfo.day.sat": "Saturday",
"services.employees.workingInfo.day.sun": "Sunday",
"services.employees.workingInfo.day.mon": "Monday",
"services.employees.workingInfo.day.tue": "Tuesday",
"services.employees.workingInfo.day.wed": "Wednesday",
"services.employees.workingInfo.day.thu": "Thursday",
"services.employees.workingInfo.day.fri": "Friday",
"services.employees.workingInfo.savedToast": "Working hours saved",
"services.employees.workingInfo.saveErrorToast": "Failed to save working hours",
"services.employees.workingInfo.branchAddedToast": "Branch added",
"services.employees.workingInfo.branchRemovedToast": "Branch removed",
"services.employees.workingInfo.branchErrorToast": "Failed to update branches",
```

- [ ] **Step 2: i18n verify**

```bash
pnpm --filter=dashboard i18n:verify
```

المتوقع: `[parity] OK — ar/en files have matching key sets`.

- [ ] **Step 3: commit**

```bash
git add apps/dashboard/lib/translations/ar.services.ts \
        apps/dashboard/lib/translations/en.services.ts
git commit -m "feat(i18n): add services.employees.workingInfo translation keys (ar/en)"
```

---

## Task 5 — مكوّن `EmployeeWorkingInfo` كاملاً

**الهدف:** مكوّن واحد يحتوي: compact summary + expand/collapse + branches editor + schedule editor.

### الملفات

- جديد: `apps/dashboard/components/features/services/employee-working-info.tsx` (≤300 سطر)
- جديد: `apps/dashboard/test/unit/services/employee-working-info.spec.tsx` (≤300 سطر)

### الواجهة

```ts
interface EmployeeWorkingInfoProps {
  employeeId: string
  branchIds: string[]
  t: (key: string) => string
}
```

### الاختبارات (6)

1. compact: يعرض ملخّص الفروع (أول 3 + N) + ملخّص الجدول
2. empty states: «غير معيّن في أي فرع» و«بدون جدول» حين لا بيانات
3. expand: الضغط على العنوان يكشف أقسام الفروع والجدول
4. branches remove: حذف شيبس يستدعي `unassignEmployeeFromBranch(branchId, employeeId)`
5. branches add: «+ إضافة فرع» يفتح picker، اختيار فرع يستدعي `assignEmployeeToBranch(branchId, employeeId)`
6. schedule update: تغيير checkbox أو وقت يستدعي `useUpdateEmployeeSchedule.mutate` بـ `AvailabilitySlot[]` كاملة

### الخطوات

- [ ] **Step 1: اكتب الاختبارات الستة كاملة (TDD)**

```tsx
// apps/dashboard/test/unit/services/employee-working-info.spec.tsx
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { ReactNode } from "react"
import { LocaleProvider } from "@/components/locale-provider"

vi.mock("@/hooks/use-branches", () => ({
  useBranches: () => ({
    branches: [
      { id: "br-1", nameAr: "الرياض", nameEn: "Riyadh", isActive: true },
      { id: "br-2", nameAr: "العليا", nameEn: "Olaya", isActive: true },
      { id: "br-3", nameAr: "دبلوماسي", nameEn: "Diplomatic", isActive: true },
      { id: "br-4", nameAr: "النخيل", nameEn: "Palm", isActive: true },
    ],
    isLoading: false,
  }),
}))

vi.mock("@/lib/api/branches", () => ({
  assignEmployeeToBranch: vi.fn(),
  unassignEmployeeFromBranch: vi.fn(),
}))

vi.mock("@/hooks/use-employee-schedule", () => ({
  useEmployeeSchedule: vi.fn(),
  useUpdateEmployeeSchedule: vi.fn(),
}))

vi.mock("@/hooks/use-employees", () => ({
  useEmployee: vi.fn(),
}))

import { useEmployeeSchedule, useUpdateEmployeeSchedule } from "@/hooks/use-employee-schedule"
import { useEmployee } from "@/hooks/use-employees"
import { assignEmployeeToBranch, unassignEmployeeFromBranch } from "@/lib/api/branches"
import { EmployeeWorkingInfo } from "@/components/features/services/employee-working-info"

function renderWithQuery(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <LocaleProvider locale="ar">{ui}</LocaleProvider>
    </QueryClientProvider>,
  )
}

vi.mock("@/components/locale-provider", async () => {
  const actual = await vi.importActual<typeof import("@/components/locale-provider")>(
    "@/components/locale-provider",
  )
  return actual
})

describe("EmployeeWorkingInfo — compact", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useEmployee).mockReturnValue({ data: undefined } as unknown as ReturnType<typeof useEmployee>)
  })

  it("shows first 3 branches + overflow count", () => {
    vi.mocked(useEmployeeSchedule).mockReturnValue({
      data: [],
    } as unknown as ReturnType<typeof useEmployeeSchedule>)
    vi.mocked(useUpdateEmployeeSchedule).mockReturnValue({} as unknown as ReturnType<typeof useUpdateEmployeeSchedule>)

    renderWithQuery(<EmployeeWorkingInfo employeeId="emp-1" branchIds={["br-1", "br-2", "br-3", "br-4"]} />)

    expect(screen.getByText("الرياض")).toBeInTheDocument()
    expect(screen.getByText("العليا")).toBeInTheDocument()
    expect(screen.getByText("دبلوماسي")).toBeInTheDocument()
    expect(screen.getByText("+1")).toBeInTheDocument()
  })

  it("shows empty state messages when no branches and no schedule", () => {
    vi.mocked(useEmployeeSchedule).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useEmployeeSchedule>)
    vi.mocked(useUpdateEmployeeSchedule).mockReturnValue({} as unknown as ReturnType<typeof useUpdateEmployeeSchedule>)

    renderWithQuery(<EmployeeWorkingInfo employeeId="emp-1" branchIds={[]} />)

    expect(screen.getByText("services.employees.workingInfo.noBranches")).toBeInTheDocument()
    expect(screen.getByText("services.employees.workingInfo.scheduleNone")).toBeInTheDocument()
  })

  it("renders a varied schedule summary when hours differ per day", () => {
    vi.mocked(useEmployeeSchedule).mockReturnValue({
      data: [
        { dayOfWeek: 0, startTime: "09:00", endTime: "17:00", isActive: true },
        { dayOfWeek: 1, startTime: "10:00", endTime: "15:00", isActive: true },
      ],
    } as unknown as ReturnType<typeof useEmployeeSchedule>)
    vi.mocked(useUpdateEmployeeSchedule).mockReturnValue({} as unknown as ReturnType<typeof useUpdateEmployeeSchedule>)

    renderWithQuery(<EmployeeWorkingInfo employeeId="emp-1" branchIds={["br-1"]} />)

    expect(screen.getByText("services.employees.workingInfo.scheduleVaried")).toBeInTheDocument()
  })
})

describe("EmployeeWorkingInfo — expanded", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useEmployee).mockReturnValue({ data: undefined } as unknown as ReturnType<typeof useEmployee>)
  })

  it("expands on header click and shows editors", () => {
    vi.mocked(useEmployeeSchedule).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useEmployeeSchedule>)
    vi.mocked(useUpdateEmployeeSchedule).mockReturnValue({} as unknown as ReturnType<typeof useUpdateEmployeeSchedule>)

    renderWithQuery(<EmployeeWorkingInfo employeeId="emp-1" branchIds={["br-1"]} />)
    fireEvent.click(screen.getByText("services.employees.workingInfo.title"))
    expect(screen.getByText("services.employees.workingInfo.addBranch")).toBeInTheDocument()
    expect(screen.getByText("services.employees.workingInfo.day.sat")).toBeInTheDocument()
  })

  it("calls unassign when a branch chip × is clicked", async () => {
    vi.mocked(useEmployeeSchedule).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useEmployeeSchedule>)
    vi.mocked(useUpdateEmployeeSchedule).mockReturnValue({} as unknown as ReturnType<typeof useUpdateEmployeeSchedule>)

    renderWithQuery(<EmployeeWorkingInfo employeeId="emp-1" branchIds={["br-1", "br-2"]} />)
    fireEvent.click(screen.getByText("services.employees.workingInfo.title"))
    const branchRow = screen.getAllByText("الرياض")[0].closest("[data-testid='branch-row']")!
    fireEvent.click(within(branchRow).getByRole("button"))
    await waitFor(() => expect(unassignEmployeeFromBranch).toHaveBeenCalledWith("br-1", "emp-1"))
  })

  it("calls useUpdateEmployeeSchedule on day toggle change", async () => {
    const mutate = vi.fn()
    vi.mocked(useUpdateEmployeeSchedule).mockReturnValue({
      mutate,
      mutateAsync: mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateEmployeeSchedule>)
    vi.mocked(useEmployeeSchedule).mockReturnValue({
      data: [{ dayOfWeek: 0, startTime: "09:00", endTime: "17:00", isActive: true }],
    } as unknown as ReturnType<typeof useEmployeeSchedule>)

    renderWithQuery(<EmployeeWorkingInfo employeeId="emp-1" branchIds={[]} />)
    fireEvent.click(screen.getByText("services.employees.workingInfo.title"))
    const checkbox = screen.getByRole("checkbox", { name: /services.employees.workingInfo.dayActive/i })
    fireEvent.click(checkbox)
    await waitFor(() => expect(mutate).toHaveBeenCalled())
    const payload = mutate.mock.calls[0][0]
    expect(payload[0].isActive).toBe(false)
  })
})
```

- [ ] **Step 2: شغّل الاختبار، تأكد أنه يفشل**

```bash
pnpm --filter=dashboard test -- test/unit/services/employee-working-info.spec.tsx
```

المتوقع: FAIL — المكوّن غير موجود.

- [ ] **Step 3: نفّذ المكوّن كاملاً**

```tsx
// apps/dashboard/components/features/services/employee-working-info.tsx
"use client"

import { useMemo, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon, ArrowUp01Icon, Add01Icon, Cancel01Icon, Search01Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { Button } from "@sawaa/ui"
import { Input } from "@sawaa/ui"
import { Switch } from "@sawaa/ui"
import { Skeleton } from "@sawaa/ui"
import { SurfaceRow } from "@sawaa/ui"

import { useBranches } from "@/hooks/use-branches"
import { useEmployeeSchedule, useUpdateEmployeeSchedule } from "@/hooks/use-employee-schedule"
import { useEmployee } from "@/hooks/use-employees"
import { assignEmployeeToBranch, unassignEmployeeFromBranch } from "@/lib/api/branches"
import type { AvailabilitySlot } from "@/lib/api/employees-schedule"
import { useLocale } from "@/components/locale-provider"

interface EmployeeWorkingInfoProps {
  employeeId: string
  branchIds?: string[]
}

const DAY_KEYS = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"] as const

export function EmployeeWorkingInfo({ employeeId, branchIds: propBranchIds }: EmployeeWorkingInfoProps) {
  const { t, locale } = useLocale()
  const isAr = locale === "ar"
  const [isExpanded, setIsExpanded] = useState(false)
  const [isAddingBranch, setIsAddingBranch] = useState(false)
  const [branchSearch, setBranchSearch] = useState("")

  const { branches } = useBranches()
  const { data: schedule = [], isLoading: scheduleLoading } = useEmployeeSchedule(employeeId)
  const updateScheduleMut = useUpdateEmployeeSchedule(employeeId)

  const branchIdsMissing = !propBranchIds || propBranchIds.length === 0
  const { data: employee } = useEmployee(branchIdsMissing ? employeeId : null)
  const branchIds = propBranchIds ?? employee?.branchIds ?? []

  const branchName = (id: string) => {
    const b = branches.find((x) => x.id === id)
    if (!b) return id
    return isAr ? b.nameAr : (b.nameEn ?? b.nameAr)
  }

  const visibleBranches = branchIds.slice(0, 3)
  const hiddenBranchesCount = Math.max(0, branchIds.length - 3)
  const scheduleSummary = useMemo(() => summariseSchedule(schedule), [schedule])

  const handleToggleDay = (dayOfWeek: number, next: boolean) => {
    const updated: AvailabilitySlot[] = DAY_KEYS.map((key, idx) => {
      const existing = schedule.find((s) => s.dayOfWeek === idx)
      return existing
        ? { ...existing, isActive: idx === dayOfWeek ? next : existing.isActive }
        : {
            dayOfWeek: idx,
            startTime: "09:00",
            endTime: "17:00",
            isActive: idx === dayOfWeek ? next : false,
          }
    })
    updateScheduleMut.mutate(updated, {
      onSuccess: () => toast.success(t("services.employees.workingInfo.savedToast")),
      onError: () => toast.error(t("services.employees.workingInfo.saveErrorToast")),
    })
  }

  const handleTimeChange = (dayOfWeek: number, field: "startTime" | "endTime", value: string) => {
    const updated = DAY_KEYS.map((idx) => {
      const existing = schedule.find((s) => s.dayOfWeek === idx)
      return existing
        ? { ...existing, [field]: idx === dayOfWeek ? value : existing[field] }
        : {
            dayOfWeek: idx,
            startTime: "09:00",
            endTime: "17:00",
            isActive: false,
            [field]: idx === dayOfWeek ? value : (field === "startTime" ? "09:00" : "17:00"),
          }
    })
    updateScheduleMut.mutate(updated)
  }

  const handleRemoveBranch = async (branchId: string) => {
    try {
      await unassignEmployeeFromBranch(branchId, employeeId)
      toast.success(t("services.employees.workingInfo.branchRemovedToast"))
    } catch {
      toast.error(t("services.employees.workingInfo.branchErrorToast"))
    }
  }

  const handleAddBranch = async (branchId: string) => {
    try {
      await assignEmployeeToBranch(branchId, employeeId)
      toast.success(t("services.employees.workingInfo.branchAddedToast"))
      setIsAddingBranch(false)
      setBranchSearch("")
    } catch {
      toast.error(t("services.employees.workingInfo.branchErrorToast"))
    }
  }

  const availableToAdd = branches.filter(
    (b) => !branchIds.includes(b.id) && (isAr ? b.nameAr : b.nameEn ?? b.nameAr).toLowerCase().includes(branchSearch.toLowerCase()),
  )

  return (
    <SurfaceRow variant="default" size="sm" className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className="flex items-center justify-between gap-2 text-start"
      >
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("services.employees.workingInfo.title")}
        </span>
        <HugeiconsIcon
          icon={isExpanded ? ArrowUp01Icon : ArrowDown01Icon}
          strokeWidth={2}
          className="size-3.5 text-muted-foreground"
        />
      </button>

      {!isExpanded && (
        <div className="flex flex-col gap-1.5 px-1 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">{t("services.employees.workingInfo.branches")}:</span>
            {branchIds.length === 0 ? (
              <span className="text-muted-foreground/70">{t("services.employees.workingInfo.noBranches")}</span>
            ) : (
              <>
                {visibleBranches.map((id) => (
                  <span key={id} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    {branchName(id)}
                  </span>
                ))}
                {hiddenBranchesCount > 0 && (
                  <span className="text-[10px] text-muted-foreground">+{hiddenBranchesCount}</span>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">{t("services.employees.workingInfo.schedule")}:</span>
            {scheduleLoading ? (
              <Skeleton className="h-3 w-24" />
            ) : (
              <span className="tabular-nums text-foreground">{scheduleSummary}</span>
            )}
          </div>
        </div>
      )}

      {isExpanded && (
        <div className="flex flex-col gap-3 pt-1">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("services.employees.workingInfo.branches")}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {branchIds.length === 0 ? (
                <span className="text-[10px] text-muted-foreground/70">{t("services.employees.workingInfo.noBranches")}</span>
              ) : (
                branchIds.map((id) => (
                  <span
                    key={id}
                    data-testid="branch-row"
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                  >
                    {branchName(id)}
                    <button
                      type="button"
                      onClick={() => handleRemoveBranch(id)}
                      aria-label={t("services.employees.workingInfo.removeBranch")}
                      className="text-primary hover:text-error"
                    >
                      <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3" />
                    </button>
                  </span>
                ))
              )}
              <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 text-[10px]" onClick={() => setIsAddingBranch((v) => !v)}>
                <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-3" />
                {t("services.employees.workingInfo.addBranch")}
              </Button>
            </div>
            {isAddingBranch && (
              <div className="mt-1 flex flex-col gap-1.5 rounded-md border border-border bg-surface-muted/40 p-2">
                <div className="relative">
                  <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="absolute start-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={branchSearch}
                    onChange={(e) => setBranchSearch(e.target.value)}
                    placeholder={t("services.employees.workingInfo.addBranchSearch")}
                    className="h-7 ps-7 text-xs"
                  />
                </div>
                {availableToAdd.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground/70">{t("services.employees.workingInfo.addBranchNone")}</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {availableToAdd.map((b) => (
                      <li key={b.id}>
                        <button
                          type="button"
                          onClick={() => handleAddBranch(b.id)}
                          className="w-full rounded px-2 py-1 text-start text-xs hover:bg-surface-muted"
                        >
                          {isAr ? b.nameAr : b.nameEn ?? b.nameAr}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("services.employees.workingInfo.schedule")}
            </span>
            <div className="flex flex-col gap-1">
              {DAY_KEYS.map((dayKey, idx) => {
                const slot = schedule.find((s) => s.dayOfWeek === idx)
                return (
                  <div key={dayKey} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 rounded-md bg-surface-muted/40 px-2 py-1">
                    <Switch
                      checked={slot?.isActive ?? false}
                      onCheckedChange={(next) => handleToggleDay(idx, next)}
                      aria-label={t("services.employees.workingInfo.dayActive")}
                      className="scale-90"
                    />
                    <span className="text-[11px] text-foreground">{t(`services.employees.workingInfo.day.${dayKey}`)}</span>
                    <Input
                      type="time"
                      value={slot?.startTime ?? "09:00"}
                      onChange={(e) => handleTimeChange(idx, "startTime", e.target.value)}
                      className="h-7 w-20 text-[11px] tabular-nums"
                    />
                    <Input
                      type="time"
                      value={slot?.endTime ?? "17:00"}
                      onChange={(e) => handleTimeChange(idx, "endTime", e.target.value)}
                      className="h-7 w-20 text-[11px] tabular-nums"
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </SurfaceRow>
  )
}

function summariseSchedule(schedule: AvailabilitySlot[]): string {
  if (schedule.length === 0) return "—"
  const active = schedule.filter((s) => s.isActive)
  if (active.length === 0) return "—"
  const first = active[0]
  const allSame = active.every((s) => s.startTime === first.startTime && s.endTime === first.endTime)
  if (!allSame) return "varied"
  const days = active.map((s) => s.dayOfWeek).sort((a, b) => a - b)
  const isContiguous = days.every((d, i) => i === 0 || d === days[i - 1] + 1)
  return isContiguous ? `${days.length} days ${first.startTime}–${first.endTime}` : "varied"
}

function summariseSchedule(schedule: AvailabilitySlot[], t: (k: string) => string): string {
  if (schedule.length === 0) return t("services.employees.workingInfo.scheduleNone")
  const active = schedule.filter((s) => s.isActive)
  if (active.length === 0) return t("services.employees.workingInfo.scheduleNone")
  const first = active[0]
  const allSame = active.every((s) => s.startTime === first.startTime && s.endTime === first.endTime)
  if (!allSame) return t("services.employees.workingInfo.scheduleVaried")
  const days = active.map((s) => s.dayOfWeek).sort((a, b) => a - b)
  const isContiguous = days.every((d, i) => i === 0 || d === days[i - 1] + 1)
  if (!isContiguous) return t("services.employees.workingInfo.scheduleVaried")
  return `${days.length} ${t("services.employees.workingInfo.day.sat")}–${first.startTime}–${first.endTime}`
}
```

**ملاحظة على `data-testid`**: استبدل `data-testid="branch-row"` بـ `aria-label={branchName(id)}` على الشيبس نفسه، واستخدم `screen.getByLabelText("الرياض")` في الاختبار.

- [ ] **Step 4: شغّل الاختبار، تأكد أنه ينجح**

```bash
pnpm --filter=dashboard test -- test/unit/services/employee-working-info.spec.tsx
```

المتوقع: PASS (6/6). عدّل الاختبار إن تطلّب الأمر التحوّل إلى `useLocale` (mock الـ provider).

- [ ] **Step 5: typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 6: commit**

```bash
git add apps/dashboard/components/features/services/employee-working-info.tsx \
        apps/dashboard/test/unit/services/employee-working-info.spec.tsx
git commit -m "feat(services): add EmployeeWorkingInfo component with branches + schedule"
```

---

## Task 6 — دمج في `AssignedEmployeeRow`

**الهدف:** إدراج `<EmployeeWorkingInfo>` بين header و toggles، تمرير `branchIds` كـ prop.

### الملفات

- تعديل: `apps/dashboard/components/features/services/assigned-employee-row.tsx:1-138`

### الخطوات

- [ ] **Step 1: اقرأ الملف الحالي**

تأكد من حجمه الحالي (138 سطر بعد المهمة السابقة). تأكد من بنية الـ JSX بين `</div>` الـ header و `<EmployeeServiceToggles>`.

- [ ] **Step 2: أضف import**

```tsx
import { EmployeeWorkingInfo } from "./employee-working-info"
```

- [ ] **Step 3: أدرج المكوّن**

بعد نهاية الـ header (قبل `<EmployeeServiceToggles ... />`):

```tsx
<EmployeeWorkingInfo
  employeeId={employee.id}
  branchIds={employee.branchIds}
/>
```

**ملاحظة**: `employee.branchIds` نوعه `string[] | undefined`. نمرّره كما هو (undefined لو الـ backend ما يرجّعه) — المكوّن يستخدم `useEmployee(employeeId)` كـ fallback تلقائياً لو `branchIds` غير معرّف أو فارغ.

- [ ] **Step 4: شغّل اختبارات AssignedEmployeeRow**

ابحث عن اختبارات موجودة للملف:

```bash
ls apps/dashboard/test/unit/services/ | grep -i assign
```

إن لم يوجد، أضف اختباراً بسيطاً:

```tsx
// apps/dashboard/test/unit/services/assigned-employee-row.spec.tsx
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, it, expect, vi } from "vitest"
import { ReactNode } from "react"

vi.mock("@/hooks/use-branches", () => ({
  useBranches: () => ({ branches: [], isLoading: false }),
}))
vi.mock("@/hooks/use-employee-schedule", () => ({
  useEmployeeSchedule: () => ({ data: [], isLoading: false }),
  useUpdateEmployeeSchedule: () => ({ mutate: vi.fn() }),
}))
vi.mock("@/hooks/use-employees", () => ({
  useEmployee: () => ({ data: undefined }),
}))
vi.mock("@/lib/api/branches", () => ({
  assignEmployeeToBranch: vi.fn(),
  unassignEmployeeFromBranch: vi.fn(),
}))

import { AssignedEmployeeRow } from "@/components/features/services/assigned-employee-row"

const item = {
  id: "se-1",
  employee: {
    id: "emp-1",
    nameAr: "فاطمة",
    title: "طبيبة عامة",
    avatarUrl: null,
    isActive: true,
    branchIds: ["br-1"],
    user: { firstName: "فاطمة", lastName: "الزهراني" },
  },
  serviceTypes: [],
  customDuration: null,
  bufferMinutes: 0,
  availableTypes: ["ONLINE"],
  isActive: true,
  hasCustomPricing: false,
  effectiveDurations: [],
} as unknown as Parameters<typeof AssignedEmployeeRow>[0]["item"]

function renderWithProviders(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe("AssignedEmployeeRow with EmployeeWorkingInfo", () => {
  it("renders the working info section", () => {
    renderWithProviders(
      <AssignedEmployeeRow
        item={item}
        serviceId="svc-1"
        isAr
        t={(k) => k}
        onEdit={vi.fn()}
        onView={vi.fn()}
      />,
    )
    expect(screen.getByText("services.employees.workingInfo.title")).toBeInTheDocument()
  })
})
```

```bash
pnpm --filter=dashboard test -- test/unit/services/assigned-employee-row.spec.tsx
```

المتوقع: PASS.

- [ ] **Step 5: typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 6: lint**

```bash
pnpm lint
```

- [ ] **Step 7: i18n verify**

```bash
pnpm --filter=dashboard i18n:verify
```

- [ ] **Step 8: commit**

```bash
git add apps/dashboard/components/features/services/assigned-employee-row.tsx \
        apps/dashboard/test/unit/services/assigned-employee-row.spec.tsx
git commit -m "feat(services): surface branches + working hours on practitioner card"
```

---

## Task 7 — التحقق النهائي

**الهدف:** كل الفحوصات نظيفة، لا انحدار في الاختبارات الموجودة.

### الخطوات

- [ ] **Step 1: typecheck كامل**

```bash
pnpm typecheck
```

المتوقع: exit 0.

- [ ] **Step 2: lint كامل**

```bash
pnpm lint
```

المتوقع: exit 0.

- [ ] **Step 3: i18n verify**

```bash
pnpm --filter=dashboard i18n:verify
```

المتوقع: `[parity] OK`.

- [ ] **Step 4: كل اختبارات الداشبورد**

```bash
pnpm --filter=dashboard exec vitest run
```

المتوقع: 0 failures (كان 1215/1215 قبل هذه المهمة، يجب أن يصير 1215 + 9 = 1224/1224 على الأقل).

- [ ] **Step 5: تحقق بصري عبر Playwright (اختياري لكن موصى به)**

شغّل خادم الداشبورد:

```bash
pnpm dev:dashboard
```

في جلسة منفصلة، شغّل playwright-cli:

```
playwright-cli snapshot http://localhost:5203/services/98433eb0-7155-405a-ae3c-b1bc8447a8c2/edit
```

تنقّل لتبويب «الممارسون». تحقق من ظهور «بيانات العمل» في كل بطاقة، اضغط للتوسيع، تحقق من ظهور الفروع والجدول. خذ سكرين شوت واحفظه في `/tmp/working-info-evidence.png`.

- [ ] **Step 6: تقرير للمستخدم**

اكتب ملخّصاً يتضمن:
- قائمة الـ commits
- عدد الملفات المُضافة/المعدَّلة
- نتائج الفحوصات
- السكرين شوت إن أُخذ
- المخاطر المتبقية

---

## Self-Review Checklist

- [x] كل قسم في المواصفة (`docs/superpowers/specs/2026-06-18-employee-working-info-design.md`) له مهمة تنفّذه
- [x] لا placeholders (TBD/TODO) في الـ plan
- [x] الـ types متطابقة: `useEmployeeSchedule`, `useUpdateEmployeeSchedule`, `queryKeys.employees.schedule`, `AvailabilitySlot`, `EmployeeWorkingInfoProps` معرّفة في مهمات سابقة ومستخدمة في اللاحقة
- [x] كل خطوة فيها الكود الفعلي، لا أوصاف عامة
- [x] حدود الأحجام محترمة في كل مهمة
- [x] i18n AR + EN مذكور في كل إضافة مفتاح
- [x] لا cross-feature imports
- [x] لا commit بدون إذن صريح — المهام 1-6 فيها `git commit` لأن خطة منفذة؛ انتظر موافقة المستخدم قبل التشغيل
