# تسليمات المرحلة 2 — خطة التنفيذ المنظمة

**التاريخ:** 2026-11-19  
**الفرع:** `integration/maintainability`  
**الحالة:** وثائق مرجعية جاهزة — لا كود إنتاجي تغيّر بعد.

## الغرض

هذه الوثائق هي المرجع الدائم لتنفيذ البنود الأربعة الكبيرة المتبقية في المرحلة 2. كل بند له:
- ملف تسليم مستقل بالهيكل الثماني،
- معيار قبول قابل للقياس،
- مسار تشغيل موثق،
- حدود ملكية صريحة.

## لماذا لا تُنفذ بالتوازي

الأربعة **ليست مستقلة**:

- **MNT-17 وMNT-18 يتقاطعان**: `create-booking` و`refund-payment` و`moyasar-*` تظهر في كليهما. تنفيذهما معًا في وقت واحد يخلق تعارضًا مباشرًا في نفس الملفات.
- **MNT-19 يمس حدود الوحدات** التي ستحتاجها خدمات MNT-17. تغيير الملكية أثناء إصلاح الكتابات العابرة يخلق مرجعين متنقلين.
- **MNT-21 مستقل تقنيًا** عن الثلاثة (واجهات الجوال)، لكن تعديل `.github/**` ومسارات البناء يحتاج تنسيقًا مع أي تغيير في البوابة، ويجب ألا يكون في نفس نافذة بناء المتجر مع تغييرات خلفية غير مستقرة.

## الترتيب المعتمد

```text
الموجة 1 (تأسيس):
  MNT-19.1  ADR ملكية حقول المصادقة
  MNT-21.1  ADR اختيار workspace الجوال
  MNT-17.1  خدمة finance الضيقة (بلا ترحيل مواضع بعد)

الموجة 2 (الأقل خطرًا):
  MNT-18.1  confirm-operation
  MNT-18.2  book-from-credit
  MNT-17.3  مواضع bookings → finance غير المالية الحرجة
  MNT-19.3  forwardRef comms ↔ identity

الموجة 3 (المالية الحرجة — بموافقة مالك وsandbox):
  MNT-17.3  create-booking وdelete-booking
  MNT-17.4  finance → bookings
  MNT-18.3  create-booking
  MNT-18.4  init-package-purchase
  MNT-18.5  moyasar-payment-settlement
  MNT-18.6  moyasar-webhook
  MNT-18.7  refund-payment

الموجة 4 (الاستقلال):
  MNT-19   بقية الأزواج وforwardRef
  MNT-21   تنفيذ workspace + توحيد BookingStatus + TestFlight
```

## قواعد العمل

1. **فرع لكل بند:** `codex/mnt-17-*`, `codex/mnt-18-*`, `codex/mnt-19-*`, `codex/mnt-21-*`.
2. **PR إلى `integration/maintainability` فقط** — لا شيء يصل `develop` قبل اكتمال الخطة.
3. **merge commit فقط** — squash/rebase مرفوضان بقاعدة المستودع.
4. **موافقة مالك صريحة** قبل أي تغيير في: auth/guards/CASL، payments/Moyasar، `.github/**`، `AGENTS.md`، `CLAUDE.md`.
5. **لا تنفيذ متوازٍ** بين MNT-17 وMNT-18 على نفس الملفات. إذا لزم التوازي، يكون بين MNT-21 وبند خلفي واحد فقط، وبمجلدات كتابة منفصلة.
6. **كل PR يذكر:** الأمر المنفذ، رمز الخروج، وSHA المرشح.
7. **لا يُحدَّث baseline بـ`--write-baseline`** — تُحذف السطور المصلحة يدويًا ويُثبت `git diff` أن التغيير حذف فقط.

## بوابة الدمج

كل PR يحتاج الفحصين الإلزاميين بنفس الاسمين:

- `gate` — تجميعي لخمس مهام: `gate/lint`، `gate/backend`، `gate/web`، `gate/mobile`، `gate/security`.
- `critical-real-e2e` — 43 ملف e2e على قاعدة بيانات حقيقية (86 إشارة `--required` في السكربت، بلا تكرار).

زمن `gate` المقاس بعد MNT-14: **7.7 دقيقة**. زمن `critical-real-e2e` **لم يُقَس في هذه الجلسة**؛ لا تعتمد رقمًا غير موثق.

## حالة البنود

| البند | الملف | الحالة | الحاجز |
|---|---|---|---|
| MNT-17 | [`MNT-17.md`](./MNT-17.md) | جاهز للبدء | موافقة مالك للمسارات المالية + sandbox |
| MNT-18 | [`MNT-18.md`](./MNT-18.md) | جاهز للبدء | موافقة مالك لـ3 handlers + sandbox |
| MNT-19 | [`MNT-19.md`](./MNT-19.md) | محظور على ADR | قرار ملكية حقول المصادقة |
| MNT-21 | [`MNT-21.md`](./MNT-21.md) | جاهز للبدء | قرار workspace + قرار إثبات TestFlight قبل `develop` |

## ما لا تغطيه هذه الوثائق

- البنود المتبقية الأخرى: MNT-11، MNT-16، MNT-20، MNT-22.
- أي نشر إلى `develop` أو staging أو production.
- أي قرار ملكي لم يُتخذ بعد.

## المراجع

- `docs/plans/maintainability-roadmap.md` — الخطة الحيّة.
- `docs/operations/deployment-policy.md` — سياسة النشر.
- `docs/operations/migration-charter.md` — قيود الترحيل.
- `scripts/backend-boundaries-baseline.json` — دَين الحدود المقفل.
- `.github/workflows/merge-gate.yml` — البوابة.
