# Employee Pricing Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** عرض وتحرير سعر/مدة كل معالج كمصفوفة (مدة × نوع حضور) موحّدة تميّز الموروث عن المخصّص، وتوصيل المدد المملوكة للمعالج (الجزء WIP) من الباك إند للواجهة.

**Architecture:** الباك إند يصدّر أصلاً `resolveEffectiveDurations()` التي تُرجع المدد الفعّالة مجمّعة حسب نوع الحضور بنفس شكل `PractitionerDurationGroup[]`. نملأ بها حقل `effectiveDurations` في قراءة معالجي الخدمة، ونوصّل `SetEmployeeDurationsHandler` بـ endpoint `PUT …/durations`. في الواجهة نطوّر `employee-custom-pricing-row.tsx` ليقرأ `effectiveDurations` ويعرضها كمصفوفة قابلة للتحرير تحفظ عبر `durationsMut` — والاختبار `employee-durations-editor.test.tsx` مكتوب مسبقاً (TDD أحمر) ويحدّد السلوك بالكامل.

**Tech Stack:** NestJS 11 + Prisma 7 (Jest) / Next.js 15 + React 19 + TanStack Query (Vitest) / `@sawaa/ui`.

## Global Constraints

- المال يُخزَّن ويُرسَل **هللات صحيحة (integer halalas)**؛ العرض للمستخدم بالريال. التحويل عبر `halalasToSarNumber` / `sarToHalalas` المستوردة أصلاً في `employee-custom-pricing-row.tsx`.
- `deliveryType` القيمة الرسمية **uppercase** (`IN_PERSON` / `ONLINE`)؛ بينما `item.availableTypes` في الواجهة **lowercase** (`in_person` / `online`) — أي مطابقة بينهما case-insensitive.
- الـ migration الخاص بـ `employeeServiceId` مُطبّق مسبقاً (`20260619000000_employee_duration_options`). **لا migration جديد** في هذه الخطة. المايجريشن غير قابلة للتعديل.
- بعد أي تغيير endpoint: `npm run openapi:build-and-snapshot` من `apps/backend`، والتزام `apps/backend/openapi.json` مع التغيير (CI يفشل على الانحراف).
- اختبارات الباك إند Jest مُلازِمة `*.handler.spec.ts`؛ اختبارات الواجهة Vitest تحت `apps/dashboard/test/unit/`.
- مصطلح العميل «موعد» لا «حجز» في أي نص واجهة للعميل (لا نص عميل في هذه الخطة).
- خارج النطاق: اتساق سعر المعالج المخصّص في الموقع والموبايل (مهمة لاحقة موثّقة في الـ spec).

---

### Task 1: تسجيل `SetEmployeeDurationsHandler` في موديول org-experience

`SetEmployeeDurationsHandler` موجود ومُختبَر لكنه غير مسجّل كـ provider، فلا يمكن حقنه في الكنترولر.

**Files:**
- Modify: `apps/backend/src/modules/org-experience/org-experience.module.ts` (قائمة `serviceHandlers` ~أسطر 49-56)

**Interfaces:**
- Produces: `SetEmployeeDurationsHandler` متاح للحقن في `DashboardPeopleController` (Task 2) عبر providers/exports الموديول.

- [ ] **Step 1: أضف الاستيراد والتسجيل**

أضف الاستيراد أعلى الملف (بجانب بقية استيرادات `set-employee-*`):

```typescript
import { SetEmployeeDurationsHandler } from './services/set-employee-durations/set-employee-durations.handler';
```

وأضف `SetEmployeeDurationsHandler` إلى مصفوفة `serviceHandlers`:

```typescript
const serviceHandlers = [
  CreateServiceHandler, UpdateServiceHandler, ListServicesHandler, GetServiceHandler, ArchiveServiceHandler,
  RestoreServiceHandler,
  PriceResolverService, GetDurationOptionsHandler, SetDurationOptionsHandler, SetEmployeeServiceOptionsHandler,
  SetServiceBookingConfigsHandler, GetServiceBookingConfigsHandler,
  ListServiceEmployeesHandler,
  SetEmployeeCustomPricingHandler,
  SetEmployeeDurationsHandler,
];
```

تأكّد أن `serviceHandlers` مدرجة في كل من `providers` و`exports` للموديول (اتبع النمط القائم — `SetEmployeeCustomPricingHandler` مُصدّر بنفس الطريقة لأن الكنترولر في `src/api` يحقنه).

- [ ] **Step 2: تحقق من البناء**

Run: `cd apps/backend && npm run typecheck`
Expected: PASS (لا أخطاء حقن/استيراد).

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/org-experience/org-experience.module.ts
git commit -m "feat(backend): register SetEmployeeDurationsHandler provider"
```

---

### Task 2: توصيل endpoint حفظ المدد المملوكة `PUT …/durations`

الواجهة تنادي `PUT /dashboard/people/employees/:id/services/:serviceId/durations` لكنه غير موجود. الـ DTO (`SetEmployeeDurationsDto`) والـ handler جاهزان.

**Files:**
- Modify: `apps/backend/src/api/dashboard/people.controller.ts` (imports ~56-59، constructor ~131-167، أضف endpoint بعد `custom-pricing` ~709)
- Test: `apps/backend/src/api/dashboard/people.controller.spec.ts`

**Interfaces:**
- Consumes: `SetEmployeeDurationsHandler.execute(cmd)` حيث `cmd = { employeeId, serviceId, durations }` (نوع `SetEmployeeDurationsCommand`).
- Produces: route `PUT dashboard/people/employees/:id/services/:serviceId/durations` يقبل `SetEmployeeDurationsDto` ويرجّع `PractitionerDurationGroup[]` (مخرج `buildResult`).

- [ ] **Step 1: اكتب اختبار الكنترولر الفاشل**

في `people.controller.spec.ts` أضف ضمن وصف الكنترولر (اتبع نمط الإعداد الموجود — mock للـ handlers المحقونة):

```typescript
it('setEmployeeDurationsEndpoint delegates to handler with ids + body', async () => {
  const execute = jest.fn().mockResolvedValue([]);
  (controller as any).setEmployeeDurations = { execute };
  const body = { durations: [{ deliveryType: 'IN_PERSON', items: [] }] };
  await controller.setEmployeeDurationsEndpoint('emp-uuid', 'svc-uuid', body as any);
  expect(execute).toHaveBeenCalledWith({ employeeId: 'emp-uuid', serviceId: 'svc-uuid', ...body });
});
```

- [ ] **Step 2: شغّل الاختبار وتأكد أنه يفشل**

Run: `cd apps/backend && npx jest src/api/dashboard/people.controller.spec.ts -t "setEmployeeDurationsEndpoint"`
Expected: FAIL ("setEmployeeDurationsEndpoint is not a function").

- [ ] **Step 3: أضف الاستيراد + الحقن + الـ endpoint**

الاستيرادات (بجانب `set-employee-custom-pricing`):

```typescript
import { SetEmployeeDurationsHandler } from '../../modules/org-experience/services/set-employee-durations/set-employee-durations.handler';
import { SetEmployeeDurationsDto } from '../../modules/org-experience/services/set-employee-durations/set-employee-durations.dto';
```

في الـ constructor (بجانب `setEmployeeCustomPricing`):

```typescript
private readonly setEmployeeDurations: SetEmployeeDurationsHandler,
```

الـ endpoint (بعد `setEmployeeCustomPricingEndpoint`):

```typescript
@Put('employees/:id/services/:serviceId/durations')
@CheckPermissions({ action: 'update', subject: 'Employee' })
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Set practitioner-owned duration options for an employee on a service' })
@ApiParam({ name: 'id', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
@ApiParam({ name: 'serviceId', description: 'Service UUID', example: '00000000-0000-0000-0000-000000000000' })
@ApiOkResponse({ description: 'Effective durations after update, grouped by delivery type' })
@ApiNotFoundResponse({ description: 'Employee-service assignment not found' })
setEmployeeDurationsEndpoint(
  @Param('id', ParseUUIDPipe) id: string,
  @Param('serviceId', ParseUUIDPipe) serviceId: string,
  @Body() body: SetEmployeeDurationsDto,
) {
  return this.setEmployeeDurations.execute({ employeeId: id, serviceId, ...body });
}
```

- [ ] **Step 4: شغّل الاختبار وتأكد أنه يمر**

Run: `cd apps/backend && npx jest src/api/dashboard/people.controller.spec.ts -t "setEmployeeDurationsEndpoint"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/api/dashboard/people.controller.ts apps/backend/src/api/dashboard/people.controller.spec.ts
git commit -m "feat(backend): wire PUT employee service durations endpoint"
```

---

### Task 3: ملء `effectiveDurations` في قراءة معالجي الخدمة

قائمة معالجي الخدمة لا تُرجِع `effectiveDurations`، فالمصفوفة في الواجهة تستقبل `undefined`. نملؤها بإعادة استخدام `resolveEffectiveDurations`.

**Files:**
- Modify: `apps/backend/src/modules/org-experience/services/list-service-employees.handler.ts`
- Test: `apps/backend/src/modules/org-experience/services/list-service-employees.handler.spec.ts`

**Interfaces:**
- Consumes: `resolveEffectiveDurations(serviceDefaults, ownedRows)` من `./set-employee-durations/set-employee-durations.handler` — تُرجع `Array<{ deliveryType: string; durations: Array<{ id; deliveryType; label; labelAr; durationMins; price; isInherited }> }>`.
- Produces: كل عنصر معالج في المخرج يتضمّن `effectiveDurations` بهذا الشكل (يطابق `PractitionerDurationGroup[]` في الواجهة).

- [ ] **Step 1: اكتب اختبار القراءة الفاشل**

في spec القائمة، حالة: خدمة بخيارين افتراضيين IN_PERSON ومعالج بلا صفوف مملوكة → يجب أن يرجع `effectiveDurations` فيه مجموعة IN_PERSON بصفّين `isInherited: true`:

```typescript
it('includes effectiveDurations (inherited from service defaults when none owned)', async () => {
  // رتّب الـ mocks: serviceDurationOption.findMany يرجع صفّين بـ employeeServiceId=null لخدمة،
  // ولا صفوف مملوكة للمعالج. (اتبع نمط الإعداد الموجود في هذا الـ spec.)
  const result = await handler.execute({ serviceId: 'svc-uuid' } as any);
  const emp = result[0];
  expect(emp.effectiveDurations).toBeDefined();
  const inPerson = emp.effectiveDurations.find((g: any) => g.deliveryType === 'IN_PERSON');
  expect(inPerson.durations).toHaveLength(2);
  expect(inPerson.durations[0].isInherited).toBe(true);
});
```

- [ ] **Step 2: شغّل الاختبار وتأكد أنه يفشل**

Run: `cd apps/backend && npx jest src/modules/org-experience/services/list-service-employees.handler.spec.ts -t "effectiveDurations"`
Expected: FAIL (`effectiveDurations` is undefined).

- [ ] **Step 3: نفّذ ملء الحقل**

أضف الاستيراد:

```typescript
import { resolveEffectiveDurations } from './set-employee-durations/set-employee-durations.handler';
```

داخل `execute`, بعد جلب الصفوف، احسب لكل معالج. اجلب كل `serviceDurationOption` للخدمة مرة واحدة، قسّمها (افتراضية `employeeServiceId === null` مقابل المملوكة لكل `employeeServiceId`):

```typescript
const allOptions = await this.prisma.serviceDurationOption.findMany({
  where: { serviceId, isActive: true },
  orderBy: [{ deliveryType: 'asc' }, { sortOrder: 'asc' }],
});
const serviceDefaults = allOptions.filter((o) => o.employeeServiceId === null);
const ownedByLink = new Map<string, typeof allOptions>();
for (const o of allOptions) {
  if (o.employeeServiceId === null) continue;
  if (!ownedByLink.has(o.employeeServiceId)) ownedByLink.set(o.employeeServiceId, []);
  ownedByLink.get(o.employeeServiceId)!.push(o);
}
```

ثم في بناء كل عنصر معالج (حيث `link.id` هو `EmployeeService.id`) أضف:

```typescript
effectiveDurations: resolveEffectiveDurations(serviceDefaults, ownedByLink.get(link.id) ?? []),
```

> ملاحظة: لا تُكرّر منطق الحل — استخدم `resolveEffectiveDurations` كما هي. لا تُغيّر شكل بقية الحقول الموجودة (`serviceTypes`, `hasCustomPricing`, …).

- [ ] **Step 4: شغّل الاختبار وتأكد أنه يمر**

Run: `cd apps/backend && npx jest src/modules/org-experience/services/list-service-employees.handler.spec.ts`
Expected: PASS (الحالة الجديدة + الحالات القائمة).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/org-experience/services/list-service-employees.handler.ts apps/backend/src/modules/org-experience/services/list-service-employees.handler.spec.ts
git commit -m "feat(backend): expose effectiveDurations per employee in service employees list"
```

---

### Task 4: مزامنة snapshot الـ OpenAPI + api-client

**Files:**
- Modify: `apps/backend/openapi.json` (مولّد)
- Modify (إن لزم): أنواع الداشبورد المولّدة + `packages/api-client` (يدوي) إن كان يشير لهذه المسارات.

**Interfaces:**
- Consumes: endpoint Task 2 + شكل Task 3.
- Produces: snapshot متّسق يمنع فشل CI على الانحراف.

- [ ] **Step 1: أعد توليد الـ snapshot**

Run: `cd apps/backend && npm run openapi:build-and-snapshot`
Expected: `apps/backend/openapi.json` يتضمّن مسار `…/durations` ووصف `effectiveDurations`.

- [ ] **Step 2: حدّث api-client يدوياً إن لزم**

تحقّق إن كان `packages/api-client` يشير لمعالجي الخدمة/المدد. إن لم يُشِر، لا تغيير. (الواجهة تستخدم `apps/dashboard/lib/api/*` المكتوب يدوياً والمعرّف مسبقاً — لا تغيير في Task 4.)

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/backend/openapi.json packages/api-client
git commit -m "chore(openapi): sync snapshot for employee durations endpoint"
```

---

### Task 5: تطوير `employee-custom-pricing-row` إلى مصفوفة المدد (TDD — الاختبار جاهز)

`apps/dashboard/test/unit/services/employee-durations-editor.test.tsx` مكتوب مسبقاً ويفشل حالياً. يحدّد السلوك بالكامل: أقسام لكل نوع حضور مدعوم، صفوف مدة/سعر بدون عمود تسمية، badge للموروث، إضافة/حذف صف، حفظ بـ `SetPractitionerDurationsPayload` (هللات، توليد label/labelAr، حذف `id` عند تعديل صف موروث).

**Files:**
- Modify (إعادة كتابة): `apps/dashboard/components/features/services/employee-custom-pricing-row.tsx`
- Test (موجود): `apps/dashboard/test/unit/services/employee-durations-editor.test.tsx`

**Interfaces:**
- Consumes: `item.effectiveDurations: PractitionerDurationGroup[]`، `item.availableTypes: string[]` (lowercase)، `SetPractitionerDurationsPayload` من `@/lib/api/employees`، `halalasToSarNumber`/`sarToHalalas` (مستوردة مسبقاً).
- Produces: المكوّن `EmployeeCustomPricingRow` بـ props: `{ item, serviceId, employeeId, t, isSaving, onSave: (payload: SetPractitionerDurationsPayload) => void }`. **تغيير مهم:** نوع `onSave` صار `SetPractitionerDurationsPayload` (كان `SetCustomPricingPayload`).

- [ ] **Step 1: شغّل الاختبار وتأكد أنه يفشل (أحمر)**

Run: `cd apps/dashboard && pnpm test -- test/unit/services/employee-durations-editor.test.tsx`
Expected: FAIL (المكوّن الحالي لا يقرأ `effectiveDurations` ولا يعرض الأقسام/الأزرار المتوقعة).

- [ ] **Step 2: أعد كتابة المكوّن ليحقق الاختبار**

استبدل محتوى الملف بالكامل:

```tsx
"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons"
import { Badge, Button, Input } from "@sawaa/ui"
import { halalasToSarNumber, sarToHalalas } from "@/lib/utils/money"
import type { ServiceEmployee } from "@/lib/types/service"
import type { SetPractitionerDurationsPayload } from "@/lib/api/employees"

interface Props {
  item: ServiceEmployee
  serviceId: string
  employeeId: string
  t: (key: string) => string
  isSaving: boolean
  onSave: (payload: SetPractitionerDurationsPayload) => void
}

const SUPPORTED = [
  { key: "in_person", dt: "IN_PERSON" as const, labelKey: "services.employees.durations.inPerson" },
  { key: "online", dt: "ONLINE" as const, labelKey: "services.employees.durations.online" },
]

interface Row {
  rid: string
  id?: string
  durationMins: number
  priceHalalas: number
  isInherited: boolean
  originalIsInherited: boolean
}

let RID = 0
const nextRid = () => `r${RID++}`

function rowsForType(item: ServiceEmployee, dt: "IN_PERSON" | "ONLINE"): Row[] {
  const group = (item.effectiveDurations ?? []).find(
    (g) => g.deliveryType.toUpperCase() === dt,
  )
  return (group?.durations ?? []).map((d) => ({
    rid: nextRid(),
    id: d.id,
    durationMins: d.durationMins,
    priceHalalas: d.price,
    isInherited: d.isInherited,
    originalIsInherited: d.isInherited,
  }))
}

export function EmployeeCustomPricingRow({ item, t, isSaving, onSave }: Props) {
  const supported = SUPPORTED.filter((s) =>
    (item.availableTypes ?? []).some((a) => a.toLowerCase() === s.key),
  )

  const [rowsByType, setRowsByType] = useState<Record<string, Row[]>>(() => {
    const init: Record<string, Row[]> = {}
    for (const s of supported) init[s.dt] = rowsForType(item, s.dt)
    return init
  })
  const [dirty, setDirty] = useState(false)

  const update = (dt: string, next: Row[]) => {
    setRowsByType((prev) => ({ ...prev, [dt]: next }))
    setDirty(true)
  }

  const addRow = (dt: string) =>
    update(dt, [
      ...(rowsByType[dt] ?? []),
      { rid: nextRid(), durationMins: 60, priceHalalas: 0, isInherited: false, originalIsInherited: false },
    ])

  const removeRow = (dt: string, rid: string) =>
    update(dt, (rowsByType[dt] ?? []).filter((r) => r.rid !== rid))

  const editRow = (dt: string, rid: string, patch: Partial<Row>) =>
    update(dt, (rowsByType[dt] ?? []).map((r) =>
      r.rid === rid ? { ...r, ...patch, isInherited: false } : r,
    ))

  const handleSave = () => {
    const durations = supported
      .map((s) => ({
        deliveryType: s.dt,
        items: (rowsByType[s.dt] ?? []).map((r) => {
          const base = {
            label: `${r.durationMins} min`,
            labelAr: `${r.durationMins} دقيقة`,
            durationMins: r.durationMins,
            price: r.priceHalalas,
          }
          return r.originalIsInherited || !r.id ? base : { id: r.id, ...base }
        }),
      }))
      .filter((g) => g.items.length > 0)
    onSave({ durations })
    setDirty(false)
  }

  return (
    <div className="flex flex-col gap-3">
      {supported.map((s) => {
        const rows = rowsByType[s.dt] ?? []
        return (
          <div key={s.dt} className="rounded-lg border border-border bg-surface p-2">
            <div className="mb-1.5 text-xs font-medium text-foreground">{t(s.labelKey)}</div>
            <div className="flex flex-col gap-1">
              {rows.map((r) => (
                <div key={r.rid} className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    className="h-8 w-20 tabular-nums"
                    aria-label={t("services.employees.durations.durationCol")}
                    value={r.durationMins}
                    onChange={(e) => editRow(s.dt, r.rid, { durationMins: Number(e.target.value) })}
                  />
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    className="h-8 w-24 tabular-nums"
                    aria-label={t("services.employees.durations.priceCol")}
                    value={halalasToSarNumber(r.priceHalalas)}
                    onChange={(e) => editRow(s.dt, r.rid, { priceHalalas: sarToHalalas(Number(e.target.value)) })}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
                  />
                  {r.isInherited && (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      {t("services.employees.durations.inherited")}
                    </Badge>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={t("services.employees.durations.remove")}
                    onClick={() => removeRow(s.dt, r.rid)}
                  >
                    <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-3.5" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 justify-start gap-1.5 text-xs"
                onClick={() => addRow(s.dt)}
              >
                <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-3.5" />
                {t("services.employees.durations.addRow")}
              </Button>
              {dirty && (
                <Button
                  type="button"
                  size="sm"
                  className="mt-1 h-7 self-end text-xs"
                  disabled={isSaving}
                  onClick={handleSave}
                >
                  {t("services.employees.durations.save")}
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

> أساس السلوك: عمود التسمية محذوف (تُولَّد تلقائياً عند الحفظ)؛ تعديل أي صف يُسقط `isInherited` ويُسقط `id` لو كان موروثاً أصلاً (`originalIsInherited`)؛ الحفظ يبني كل الأقسام المدعومة التي فيها صفوف فيحفظ القسم الآخر دون لمسه.

- [ ] **Step 3: شغّل الاختبار وتأكد أنه يمر (أخضر)**

Run: `cd apps/dashboard && pnpm test -- test/unit/services/employee-durations-editor.test.tsx`
Expected: PASS (كل الحالات التسع).

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/components/features/services/employee-custom-pricing-row.tsx
git commit -m "feat(dashboard): employee pricing matrix from effectiveDurations"
```

---

### Task 6: ربط المصفوفة بـ `durationsMut` في `assigned-employee-row`

المصفوفة صارت تحفظ `SetPractitionerDurationsPayload`، فالربط الحالي عبر `customPricingMut` لم يعد متطابق النوع. نبدّله بـ `durationsMut`.

**Files:**
- Modify: `apps/dashboard/components/features/services/assigned-employee-row.tsx` (~46-47، ~109-124)
- Test (موجود): `apps/dashboard/test/unit/services/assigned-employee-row.spec.tsx` (الـ mock يوفّر `durationsMut` أصلاً)

**Interfaces:**
- Consumes: `useEmployeeServiceMutations(employee.id).durationsMut` (`mutationFn: ({serviceId, payload: SetPractitionerDurationsPayload})`).
- Produces: `onSave` للمصفوفة يستدعي `durationsMut.mutate`.

- [ ] **Step 1: عدّل الربط**

غيّر سطر الـ hook:

```typescript
const { updateMut, durationsMut } = useEmployeeServiceMutations(employee.id)
```

وبدّل استدعاء المصفوفة:

```tsx
<EmployeeCustomPricingRow
  item={item}
  serviceId={serviceId}
  employeeId={employee.id}
  t={t}
  isSaving={durationsMut.isPending && durationsMut.variables?.serviceId === serviceId}
  onSave={(payload) =>
    durationsMut.mutate(
      { serviceId, payload },
      {
        onSuccess: () => toast.success(t("services.employees.durations.saved")),
        onError: () => toast.error(t("services.employees.durations.saveError")),
      },
    )
  }
/>
```

- [ ] **Step 2: شغّل اختبار الصف + typecheck**

Run: `cd apps/dashboard && pnpm test -- test/unit/services/assigned-employee-row.spec.tsx`
Expected: PASS

Run: `cd apps/dashboard && pnpm typecheck`
Expected: PASS (لا تعارض نوع `onSave`).

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/components/features/services/assigned-employee-row.tsx
git commit -m "feat(dashboard): save pricing matrix via durationsMut in assigned-employee-row"
```

---

### Task 7: توحيد شيت خدمة الموظف على نفس المصفوفة + إزالة الميت كود

`edit-employee-service-sheet` يستخدم `EmployeeServiceTypesEditor` المكرّر و`buildEmployeeServiceOptionsPayload` التي ترجع `null` دائماً (فلا تُحفظ التجاوزات). نوحّده على نفس المصفوفة ونحذف الميت كود.

**Files:**
- Modify: `apps/dashboard/components/features/employees/edit-employee-service-sheet.tsx`
- Delete: `apps/dashboard/components/features/employees/employee-service-types-editor.tsx`
- Delete: `apps/dashboard/components/features/employees/employee-service-option-overrides.ts` (إن لم يبقَ مستورِد لـ `makeDefaultEmployeeTypeConfigs`؛ وإلا أبقِ الملف واحذف فقط `buildEmployeeServiceOptionsPayload`)
- Test: `apps/dashboard/test/unit/employees/edit-employee-service-sheet.test.tsx` (أنشئ إن لم يوجد)

**Interfaces:**
- Consumes: `useEmployeeServiceMutations(employeeId)` → `{ updateMut, durationsMut }`؛ المصفوفة `EmployeeCustomPricingRow` (Task 5)؛ بيانات المعالج كـ `ServiceEmployee` (يجب أن يوفّرها الشيت — راجع من أين يأتي `ps`).
- Produces: الشيت يحفظ `isActive`/`bufferMinutes` عبر `updateMut`، والمدد عبر `durationsMut`. لا استدعاء لـ `buildEmployeeServiceOptionsPayload`.

- [ ] **Step 1: اكتب اختبار الشيت (سلوك الحفظ)**

أنشئ اختباراً يتحقق أن الحفظ يستدعي `updateMut` للحالة، ولا يستدعي أي مسار `options` ميت. (اتبع نمط mock الموجود في `assigned-employee-row.spec.tsx` لـ `useEmployeeServiceMutations`.)

```typescript
it("save submits isActive via updateMut and does not call a null options path", async () => {
  // رتّب mock useEmployeeServiceMutations بـ updateMut.mutateAsync = vi.fn().mockResolvedValue({})
  // و durationsMut.mutate = vi.fn()
  // رندر الشيت مفتوحاً، اضغط حفظ، توقّع updateMut.mutateAsync استُدعي مرة.
})
```

- [ ] **Step 2: شغّل الاختبار وتأكد أنه يفشل**

Run: `cd apps/dashboard && pnpm test -- test/unit/employees/edit-employee-service-sheet.test.tsx`
Expected: FAIL

- [ ] **Step 3: عدّل الشيت**

- استبدل استيراد/استخدام `EmployeeServiceTypesEditor` بـ `EmployeeCustomPricingRow` (المصفوفة)، مغذّى بـ `item` (نوع `ServiceEmployee`) و`onSave` → `durationsMut.mutate({ serviceId, payload })`.
- في `onSubmit`: أبقِ `updateMut.mutateAsync({ serviceId, payload: { isActive, bufferMinutes } })`. **احذف** كتلة `buildEmployeeServiceOptionsPayload` + `optionsMut`.
- احذف الاستيرادات غير المستخدمة.

```tsx
const { updateMut, durationsMut } = useEmployeeServiceMutations(employeeId)
// ...
const onSubmit = form.handleSubmit(async (data) => {
  if (!ps) return
  try {
    await updateMut.mutateAsync({
      serviceId: ps.serviceId,
      payload: { isActive: data.isActive, bufferMinutes: data.bufferMinutes },
    })
    toast.success(t("employees.services.updateSuccess"))
    onOpenChange(false)
  } catch (err) {
    console.error(err)
    toast.error(t("employees.services.updateError"))
  }
})
```

> إن كان `ps` لا يحمل `ServiceEmployee` كاملاً بحقل `effectiveDurations`، مرّر بيانات المعالج من نفس مصدر تبويب المعالجين (`useServiceEmployees`)، أو احذف المصفوفة من الشيت وأبقِ تحرير المدد في تبويب المعالجين فقط (مصدر واحد للحقيقة). اختر الأبسط بناءً على ما يوفّره `ps` فعلياً.

- [ ] **Step 4: احذف الميت كود وحدّث المستورِدين**

```bash
git rm apps/dashboard/components/features/employees/employee-service-types-editor.tsx
```

ابحث عن أي مستورِد متبقٍ:

Run: `cd apps/dashboard && grep -rn "employee-service-types-editor\|buildEmployeeServiceOptionsPayload\|EmployeeServiceTypesEditor" --include=*.ts --include=*.tsx`
Expected: لا نتائج (أو فقط تعريفات سَتُحذف). أزل أي استيراد متبقٍ.

- [ ] **Step 5: شغّل الاختبار + typecheck**

Run: `cd apps/dashboard && pnpm test -- test/unit/employees/edit-employee-service-sheet.test.tsx && pnpm typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A apps/dashboard/components/features/employees apps/dashboard/test/unit/employees
git commit -m "refactor(dashboard): unify employee service sheet on pricing matrix; drop dead options payload"
```

---

### Task 8: إصلاح إبطال الكاش بعد الحفظ (TODO الكاش البائت)

تعليق TODO يذكر أن قائمة معالجي الخدمة لا تُحدَّث بعد الحفظ. `durationsMut` يبطل `services.employees` و`employees.serviceTypes` لكن ليس `services.bookingTypes` (مصدر خيارات المدة المعروضة في معالج الحجز) ولا `employees.practitionerDurations`.

**Files:**
- Modify: `apps/dashboard/hooks/use-employee-mutations.ts` (`durationsMut`, ~188-198)
- Test: `apps/dashboard/test/unit/hooks/use-employee-mutations.test.tsx` (أنشئ إن لم يوجد)

**Interfaces:**
- Consumes: `queryKeys.services.bookingTypes(serviceId)`, `queryKeys.employees.practitionerDurations(employeeId, serviceId)`.
- Produces: `durationsMut.onSuccess` يبطل كل المفاتيح المتأثرة.

- [ ] **Step 1: اكتب اختبار الإبطال الفاشل**

```typescript
it("durationsMut invalidates service bookingTypes and practitionerDurations on success", async () => {
  // رتّب QueryClient مع spy على invalidateQueries، شغّل durationsMut.mutateAsync،
  // توقّع استدعاء الإبطال بمفاتيح services.bookingTypes و employees.practitionerDurations.
})
```

- [ ] **Step 2: شغّل وتأكد من الفشل**

Run: `cd apps/dashboard && pnpm test -- test/unit/hooks/use-employee-mutations.test.tsx`
Expected: FAIL

- [ ] **Step 3: وسّع إبطال `durationsMut`**

```typescript
const durationsMut = useMutation({
  mutationFn: ({ serviceId, payload }: { serviceId: string; payload: SetPractitionerDurationsPayload }) =>
    setEmployeeDurations(employeeId, serviceId, payload),
  onSuccess: (_d, vars) => {
    invalidate()
    invalidateServiceList(vars.serviceId)
    queryClient.invalidateQueries({ queryKey: queryKeys.employees.serviceTypes(employeeId, vars.serviceId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.employees.practitionerDurations(employeeId, vars.serviceId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.services.bookingTypes(vars.serviceId) })
  },
})
```

- [ ] **Step 4: شغّل وتأكد من المرور**

Run: `cd apps/dashboard && pnpm test -- test/unit/hooks/use-employee-mutations.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/hooks/use-employee-mutations.ts apps/dashboard/test/unit/hooks/use-employee-mutations.test.tsx
git commit -m "fix(dashboard): invalidate booking types + practitioner durations after saving durations"
```

---

### Task 9: تحقق شامل + تحقق حي (Definition of Done)

**Files:** لا تعديل — تحقق فقط.

- [ ] **Step 1: الاختبارات + الأنواع كاملة**

Run: `cd apps/backend && npm run test`
Expected: PASS

Run: `pnpm typecheck && pnpm --filter=dashboard test`
Expected: PASS

- [ ] **Step 2: تأكد من عدم انحراف الـ OpenAPI**

Run: `cd apps/backend && npm run openapi:build-and-snapshot && git status --porcelain apps/backend/openapi.json`
Expected: لا تغييرات غير ملتزَمة (نظيف).

- [ ] **Step 3: تحقق حي (يدوي — إلزامي قبل إعلان الإنجاز)**

شغّل `pnpm docker:up` ثم `pnpm dev:backend` و`pnpm dev:dashboard`. في الداشبورد:
1. افتح خدمة → تبويب «المعالجين».
2. تحقق أن مصفوفة كل معالج تعرض المدد (الموروثة عليها badge «موروث»).
3. عدّل سعر خلية + أضف «مدة خاصة» للمعالج، احفظ، وتأكد من رسالة النجاح وثبات القيم بعد إعادة التحميل (لا كاش بائت).
4. ابدأ حجزاً فعلياً لنفس المعالج والمدة، وتأكد أن السعر/المدة في معالج الحجز يطابقان المصفوفة.

سجّل النتيجة صراحة. إن لم يُجرَ التحقق الحي، اذكر ذلك ولا تُعلن «تم».

- [ ] **Step 4: Commit نهائي (إن لزم أي تعديل تحقق)**

```bash
git add -A && git commit -m "test: verify employee pricing matrix end-to-end"
```

---

## Self-Review

- **تغطية الـ spec:** B1 (قراءة effectiveDurations)→Task 3؛ B2 (توصيل durations)→Tasks 1-2؛ B3 (OpenAPI)→Task 4؛ F1 (مصفوفة موحّدة)→Tasks 5-7؛ F2 (إصلاح buildEmployeeServiceOptionsPayload null)→Task 7؛ F3 (invalidation)→Task 8؛ F4 (حذف المكرّر)→Task 7؛ الاختبار+التحقق الحي→Task 9. خارج النطاق (الموقع/الموبايل) موثّق ولم يُجدوَل عمداً.
- **Placeholders:** لا «TBD/لاحقاً». الكتل التي تتبع نمطاً قائماً (mock setup في specs) تُشير للنمط المرجعي الفعلي في ملف موجود، لا وصف غامض.
- **اتساق الأنواع:** `SetPractitionerDurationsPayload` (durations[].deliveryType + items[]{id?,label,labelAr,durationMins,price halalas}) متطابق بين Task 2 (DTO الباك إند)، Task 5 (بناء payload)، Task 6/8 (durationsMut). `resolveEffectiveDurations` يُرجع نفس شكل `PractitionerDurationGroup[]` المستهلَك في Task 5. `onSave` غيّر نوعه في Task 5 وانعكس في Tasks 6-7.
