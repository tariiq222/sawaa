# مواصفة: بطاقة الممارس — عرض بيانات العمل (الفروع + الجدول)

- التاريخ: 2026-06-18
- الحالة: معتمدة من المالك
- النطاق: apps/dashboard فقط (بطاقة AssignedEmployeeRow في تبويب Employees بصفحة تعديل الخدمة)

## الهدف

بطاقة الممارس في تبويب «الممارسون» بصفحة تعديل الخدمة (`/services/{id}/edit?tab=employees`) تعرض حالياً فقط:
- هوية الممارس (الاسم، التخصص، أنواع الحضور)
- سويتش التفعيل
- سويتش التسعير المخصّص
- الانتظار بين المواعيد (buffer)
- خيارات المدة والسعر لكل نوع حضور
- أزرار تعديل/عرض

ما يُعاب عليها: مدير العيادة ما يقدر يربط بين هذه البطاقة وبين «وين الموظف يشتغل فعلاً» و«متى ساعات عمله». هالبيانات تُضبط في ملف الموظف (`/employees/{id}/edit`) وما تنعكس في البطاقة.

نضيف قسماً قابلاً للطي بين الـ header والـ toggles يعرض الفروع وساعات العمل، ويتيح تعديلها inline بدون ما نفتح صفحة ثانية.

## الموقع في البطاقة

```
┌──────────────────────────────────────────────────┐
│ [Avatar]  Name                          [Active] │  ← header (موجود)
│           طبيبة عامة                              │
│           [عن بُعد]                               │
├──────────────────────────────────────────────────┤
│ ▼ بيانات العمل                          [◢]      │  ← جديد
│   الفروع:  [الرياض ×] [العليا ×] [دبلوماسي +1] │
│   ساعات العمل: الأحد-الخميس 9:00–17:00           │
│                                                    │
│   ─ عند التوسيع ─────────────────────────────   │
│   الفروع:                                          │
│     [الرياض ×] [العليا ×] [+ إضافة فرع]      │
│                                                    │
│   ساعات العمل:                                     │
│     ☑ السبت   [09:00] – [17:00]                  │
│     ☑ الأحد   [09:00] – [17:00]                  │
│     ☐ الإثنين [—] – [—]                          │
│     ☑ الثلاثاء [09:00] – [17:00]                 │
│     ☑ الأربعاء [09:00] – [17:00]                 │
│     ☑ الخميس  [09:00] – [17:00]                  │
│     ☐ الجمعة  [—] – [—]                          │
├──────────────────────────────────────────────────┤
│ [إعدادت العرض: نشطة/تسعير مخصص/buffer]         │  ← موجود
│ [المدة والتسعير: حضوري/عن بُعد...]              │  ← موجود
│ [تعديل] [عرض]                                    │  ← موجود
└──────────────────────────────────────────────────┘
```

## المكوّن الجديد

**الملف**: `apps/dashboard/components/features/services/employee-working-info.tsx`
**الحد الأعلى**: 300 سطر

### Props

```ts
interface EmployeeWorkingInfoProps {
  employeeId: string
  branchIds: string[]
  t: (key: string) => string
}
```

### State داخلي

- `isExpanded: boolean` — افتراضياً `false`
- لا state للتعديل — كل تغيير يحفظ inline فوراً (نفس نمط `EmployeeServiceToggles`)

### السلوك — مضغوط (compact)

يعرض سطرين:
- سطر الفروع: أول 3 فروع كشيبس مع × للحذف المباشر، يليه `+N` إذا أكثر
- سطر الجدول: ملخّص نصي واحد — مثلاً «الأحد-الخميس 9:00–17:00»، «متفرقة»، أو «بدون جدول»
- إذا لا فروع: «غير معيّن في أي فرع» بخط muted
- إذا لا جدول: «بدون جدول» بخط muted

### السلوك — موسّع (expanded)

**قسم الفروع**:
- شيبسات الفروع الحالية، كل شيبس فيه × للحذف (يستدعي `unassignEmployeeFromBranch`)
- زر `+ إضافة فرع` يفتح picker (يبحث في `useBranches`)
- عند الإضافة: يستدعي `assignEmployeeToBranch`
- حذف الفرع يُبطل `useEmployees` و `queryKeys.branches.employees(branchId)`

**قسم الجدول**:
- شبكة 7 صفوف (السبت → الجمعة)، كل صف يحتوي:
  - checkbox للتفعيل (`isActive`)
  - اسم اليوم
  - input وقت بداية (`startTime`)
  - input وقت نهاية (`endTime`)
- عند تغيّر أي حقل: يستدعي `useUpdateEmployeeSchedule.mutate()` فوراً
- الـ optimistic update: قيمة الحقل تنعكس محلياً قبل رد الـ API

## البيانات

### المصادر

| ما يلزم | المصدر | الموقع |
|---|---|---|
| `branchIds: string[]` للموظف | `Employee.branchIds` من `useEmployees` (مخزّن) | `apps/dashboard/lib/api/employees.ts:21` |
| أسماء الفروع | `useBranches()` | `apps/dashboard/hooks/use-branches.ts:19` |
| تعيين موظف لفرع | `assignEmployeeToBranch` | `apps/dashboard/lib/api/branches.ts:67` |
| إزالة موظف من فرع | `unassignEmployeeFromBranch` | `apps/dashboard/lib/api/branches.ts:77` |
| جدول الموظف | `fetchAvailability` | `apps/dashboard/lib/api/employees-schedule.ts:40` |
| تحديث الجدول | `setAvailability` (موجود) | `apps/dashboard/lib/api/employees-schedule.ts:49` |

### الـ fallback للفروع

لو الـ backend في `list-service-employees` ما يرجّع `branchIds` ضمن `ServiceEmployee.employee`:
- الـ component يستقبل `branchIds` كـ prop
- لو `prop.branchIds` غير معرّف أو فارغ، الـ component يستدعي `useEmployee(employeeId)` (query منفصل) ويستخرج `branchIds` من نتيجته
- لو الـ backend أضاف الحقل لاحقاً، يبقى الـ prop هو المصدر الرئيسي والأسرع

## الـ Hook الجديد

**الملف**: `apps/dashboard/hooks/use-employee-schedule.ts`
**الحد الأعلى**: 200 سطر

```ts
export function useEmployeeSchedule(employeeId: string | null) {
  return useQuery({
    queryKey: queryKeys.employees.schedule(employeeId ?? ""),
    queryFn: () => fetchAvailability(employeeId!),
    enabled: !!employeeId,
    staleTime: 60_000,
  })
}

export function useUpdateEmployeeSchedule(employeeId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (schedule: AvailabilitySlot[]) => setAvailability(employeeId!, { schedule }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.schedule(employeeId ?? "") })
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.detail(employeeId ?? "") })
    },
  })
}
```

`setAvailability` موجود في `apps/dashboard/lib/api/employees-schedule.ts:49` ويأخذ `SetAvailabilityPayload = { schedule: AvailabilitySlot[] }` (من `apps/dashboard/lib/types/employee.ts:207`). لا حاجة لإضافة دالة جديدة.

نضيف في `apps/dashboard/lib/query-keys.ts`:
- `queryKeys.employees.schedule(employeeId)` تحت قسم employees

## الترجمات

**الملفات**: `apps/dashboard/lib/translations/ar.services.ts` و `en.services.ts`

مفاتيح جديدة تحت `services.employees.workingInfo.*`، كلها بالعربية والإنجليزية معاً:

| المفتاح | AR | EN |
|---|---|---|
| `title` | بيانات العمل | Working info |
| `expand` | توسيع | Expand |
| `collapse` | طي | Collapse |
| `branches` | الفروع | Branches |
| `noBranches` | غير معيّن في أي فرع | Not assigned to any branch |
| `addBranch` | + إضافة فرع | + Add branch |
| `addBranchSearch` | ابحث عن فرع… | Search branches… |
| `addBranchEmpty` | لا نتائج | No matching branches |
| `addBranchNone` | لم تُضف فروع بعد | No branches yet — add one in Settings |
| `removeBranch` | إزالة الفرع | Remove branch |
| `schedule` | ساعات العمل | Working hours |
| `scheduleNone` | بدون جدول | No schedule |
| `scheduleVaried` | أوقات متفرقة | Varied hours |
| `dayActive` | يعمل في هذا اليوم | Works this day |
| `day.sat` | السبت | Saturday |
| `day.sun` | الأحد | Sunday |
| `day.mon` | الإثنين | Monday |
| `day.tue` | الثلاثاء | Tuesday |
| `day.wed` | الأربعاء | Wednesday |
| `day.thu` | الخميس | Thursday |
| `day.fri` | الجمعة | Friday |
| `summaryRange` | `{days} {start}–{end}` | `{days} {start}–{end}` |
| `summaryClosed` | مغلق | Closed |
| `savedToast` | تم حفظ ساعات العمل | Working hours saved |
| `saveErrorToast` | فشل حفظ ساعات العمل | Failed to save working hours |
| `branchAddedToast` | تمت إضافة الفرع | Branch added |
| `branchRemovedToast` | تمت إزالة الفرع | Branch removed |
| `branchErrorToast` | فشل تحديث الفروع | Failed to update branches |

**التحقق**: `pnpm --filter=dashboard i18n:verify` بعد الإضافة.

## الملفات المعدَّلة

| الملف | التغيير | الحد |
|---|---|---|
| `apps/dashboard/components/features/services/employee-working-info.tsx` | جديد | 300 |
| `apps/dashboard/hooks/use-employee-schedule.ts` | جديد | 200 |
| `apps/dashboard/lib/api/employees-schedule.ts` | بدون تعديل (نستخدم `setAvailability` الموجود) | 290 |
| `apps/dashboard/lib/query-keys.ts` | نضيف `queryKeys.employees.schedule` | — |
| `apps/dashboard/lib/types/service.ts` | نضيف `branchIds?: string[]` لـ `ServiceEmployee.employee` | 250 |
| `apps/dashboard/components/features/services/assigned-employee-row.tsx` | إدراج `<EmployeeWorkingInfo>` | 300 |
| `apps/dashboard/lib/translations/ar.services.ts` | مفاتيح جديدة | 300 |
| `apps/dashboard/lib/translations/en.services.ts` | مفاتيح جديدة | 300 |

## الاختبارات

**جديدة**:
- `apps/dashboard/test/unit/services/employee-working-info.spec.tsx` — 6 اختبارات:
  1. يعرض ملخّص الفروع والجدول في الوضع المضغوط
  2. يعرض «غير معيّن في أي فرع» و«بدون جدول» حين لا بيانات
  3. التوسيع يكشف قسم الفروع وقسم الجدول
  4. حذف شيبس فرع يستدعي `unassignEmployeeFromBranch` ويُبطل `useEmployees`
  5. تغيير checkbox اليوم يستدعي `useUpdateEmployeeSchedule`
  6. تغيير وقت البداية/النهاية يستدعي `useUpdateEmployeeSchedule` بقيمة محدّثة

**يجب أن تستمر بالنجاح**:
- `apps/dashboard/test/unit/services/employee-durations-editor.test.tsx` (8/8)
- `apps/dashboard/test/unit/services/edit-employee-service-sheet.spec.tsx` (5/5)
- `apps/dashboard/test/unit/services/booking-type-row.spec.tsx`
- `apps/dashboard/test/unit/features/employees/use-employee-form-price-units.spec.tsx`

## التحقق النهائي

من جذر الـ repo:
1. `pnpm typecheck` — exit 0
2. `pnpm lint` — exit 0
3. `pnpm --filter=dashboard i18n:verify` — AR/EN parity
4. `pnpm --filter=dashboard exec vitest run` — 0 failures

## خارج النطاق

- الإجازات/فترات الراحة (vacations/time-off) — تُعدَّل في `/employees/{id}/vacations`
- فترات الراحة داخل اليوم (breaks) — مكوّن `schedule-editor.tsx` الكامل في ملف الموظف يدعمها، هالقسم المختصر ما يدعمها
- قيود الفروع على مستوى الخدمة — Services → Branches tab
- إنشاء فرع جديد — Settings → Branches

## المخاطر

- **ارتفاع البطاقة عند التوسيع**: مقبول لأن المستخدم اختار expand-in-place بوعي
- **تأخير الشبكة في تعديل الفروع**: نُظهر حالة loading داخل الشيبس وقت الحذف/الإضافة (opacity 60% + spinner)
- **استجابة الـ backend لـ `branchIds` في `list-service-employees`**: غير مضمونة — الـ fallback عبر `useEmployee(employeeId)` يعالجها لكن يزيد استعلام لكل بطاقة. راجع مع فريق الباك إن أمكن إضافة الحقل للاستجابة
- **عدم تطابق الـ schedule**: قد يكون للموظف أكثر من schedule (مثلاً عطلات/استثناءات) — هالقسم يعرض الـ weekly recurring فقط
