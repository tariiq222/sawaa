# السيناريوهات الإضافية — 2026-09-14

نتيجة تشغيل فعلية: **30/30 ناجحة، 8/8 حزم، 0 فشل، 0 متجاوزة** خلال 24.104 ثانية.

التنفيذ محلي على قاعدة PostgreSQL المستقلة `codex_package_groups_test_20260913_r2`، مضيف localhost:3453، مع ضبط REAL_E2E_DATABASE_URL وتشغيل Jest بـ runInBand. هذه اختبارات تكامل بقاعدة فعلية وبعضها HTTP؛ ليست 30 رحلة متصفح. لم يصل التنفيذ إلى الإنتاج أو ينشر تغييرات.

شملت: الترتيب وعدم الترتيب، تنافس الحجز على آخر رصيد، تنافس الحضور وعدم الحضور، النقل والحجز المتزامنين، رفض نقل رصيد محجوز، ثبات الأسعار، الخصم الكامل والأسعار الصفرية، الاسترداد الجزئي والكامل وسجلهما، التراجع الكامل عند فشل السجل، تحويل القوالب القديمة وحماية الحقوق ومنع التحويل من تدقيق قديم بعد تغير المصدر أو السعر.

لم تتطلب النتائج إصلاحًا في كود المنتج. ظهر تحذير توافق مستقبلي من pg بشأن client.query المتزامن، ولم تفشل أي حالة.

حدود القبول السابقة باقية: نسخة مجموعات الباقات لم تُنشر إلى الاستيج، واختبار ميسر Sandbox لم يُنفذ بسبب تعذر فك تشفير إعداده على الاستيج.

## الحالات المنفذة

### package-group-booking-http.real-e2e-spec.ts

- PASS: creates and sells a mixed V2 package through HTTP, freezes prices, and exposes list/matching data
- PASS: enforces ordered/dependency gates, exact no-show return, cancellation return, and transfer snapshots through HTTP
- PASS: serializes two actual HTTP reservations on one final credit without overdraw

### package-template-conversion.real-e2e-spec.ts

- PASS: dry-run writes nothing, preserves six rights, and apply replays one inactive draft
- PASS: rejects reference-price drift until a refreshed audit manifest is applied
- PASS: rejects a source changed after audit before creating its first draft

### package-credit-concurrency.real-e2e-spec.ts

- PASS: rejects a stale booking after transfer commits between credit resolution and booking transaction
- PASS: rejects a full refund while checked-in usage is live, then refunds after cancellation
- PASS: keeps a sibling cancellation and final consumption consistent
- PASS: completes two final consumes under one purchase without overwriting the terminal state

### package-group-reassignment.real-e2e-spec.ts

- PASS: transfers a remaining unreserved V2 credit to a different target option without repricing
- PASS: rejects reassignment after a reserved booking, preserving the session identity

### package-group-purchase.real-e2e-spec.ts

- PASS: freezes mixed-practitioner groups and replays the same credit fields without duplicates
- PASS: issues zero-value rights without a fake payment: full-discount
- PASS: issues zero-value rights without a fake payment: zero-prices

### package-group-concurrency.real-e2e-spec.ts

- PASS: serializes two competing reservations on the same V2 credit
- PASS: serializes check-in against no-show on a V2 booking
- PASS: serializes predecessor return against a child booking attempt
- PASS: serializes transfer against a V2 booking attempt without stale routing

### package-group-sequence.real-e2e-spec.ts

- PASS: keeps ORDERED session 2 locked after reserve/check-in and opens it on delivered completion
- PASS: allows an UNORDERED session independently and blocks a dependent group until all dependency credits deliver
- PASS: keeps the same session credit identity after NO_SHOW return and allows rebooking only when its own slot is free
- PASS: exposes grouped metadata through the existing dashboard list and matching-credit controller paths

### package-refund-ledger.real-e2e-spec.ts

- PASS: records linked partials and a closing full refund with exact amounts while preserving partial capacity
- PASS: records no-invoice refunds and zero-money full cancellations as visible events without requests
- PASS: rolls back purchase, credit, invoice, payment, request, and event writes when ledger insertion fails
- PASS: serializes concurrent full refunds so one succeeds and one event/request is committed
- PASS: does not duplicate a LIVE event when the historical backfill is rerun
- PASS: keeps positive residuals undated despite refundedAt, while preserving a provable dated zero terminal event
- PASS: reports an over-cumulative legacy request/event mismatch without writing a per-purchase event
