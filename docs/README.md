# Sawa Documentation

هذا المجلد يحتوي على وثائق المشروع الإضافية خارج `CLAUDE.md` الجذر و CLAUDE.md الخاص بكل تطبيق.

## تنظيم المستودع

- [operations/repository-layout.md](./operations/repository-layout.md) — مسؤوليات المجلدات، تنظيم الجذر وسياسة الملفات المحلية.
- [architecture/code-map.md](./architecture/code-map.md) — خريطة التطبيقات والحزم ومواضع التعديل.
- [architecture/clinic-service-booking-contract.md](./architecture/clinic-service-booking-contract.md) — عقد العيادات والخدمات والحجز.

## الأدلة التشغيلية (Operations)

- [operations/deployment-policy.md](./operations/deployment-policy.md) — سياسة النشر المعتمدة؛ المرجع الحاكم لأي نشر.
- [operations/restore-runbook.md](./operations/restore-runbook.md) — إجراءات استعادة النسخ الاحتياطية (Postgres + MinIO + Env).
- [../apps/backend/docs/operations/p2-credential-rekey-2026-05-09.md](../apps/backend/docs/operations/p2-credential-rekey-2026-05-09.md) — إجراء تدوير مفاتيح تشفير الـ credentials.

## القرارات المعمارية (ADRs)

- [adr/](./adr/) — Architecture Decision Records
  - [financial-money-unit-halalas.md](./adr/financial-money-unit-halalas.md) — ADR-001: اعتماد integer halalas كوحدة تخزين للنقود.

## تقارير التدقيق (Audits)

ملفات تاريخية — Snapshot بنتائج جلسات التدقيق. لا تُعدّل بعد إنشائها إلا لتوضيح التصحيحات اللاحقة.

- [audits/2026-06-21-backend-audit.md](./audits/2026-06-21-backend-audit.md) — تدقيق الـ Backend (يونيو 2026).
- [audits/2026-06-29-website-integration-audit.md](./audits/2026-06-29-website-integration-audit.md) — تدقيق تكامل الـ Website (يونيو 2026).
- [audits/2026-06-29-project-audit.md](./audits/2026-06-29-project-audit.md) — تقرير التدقيق التنفيذي المنقول من الجذر.
- [audits/2026-09-26-booking-performance.md](./audits/2026-09-26-booking-performance.md) — تدقيق أولي لأداء الحجز؛ حدود القياس موضحة في التقرير.
- [audits/chat-integration/](./audits/chat-integration/) — تقارير المهام 10 و11 و12 الخاصة بتكامل المحادثات.
- [security-test-report-service-module.md](./security-test-report-service-module.md) — تقرير اختبار أمان الـ Service module.
- [system-analysis-report-2026-07-09.md](./system-analysis-report-2026-07-09.md) — تحليل تاريخي للنظام بتاريخ 9 يوليو 2026.

## الخطط (Plans)

- [plans/session-packages-rebuild.md](./plans/session-packages-rebuild.md) — خطة إعادة بناء حزم الجلسات.
- [plans/employee-email-payments-remediation.md](./plans/employee-email-payments-remediation.md) — خطة محفوظة من `PLAN.md` السابق؛ ليست إثباتًا للحالة الحالية.
- [plans/page-auth-architecture-remediation.md](./plans/page-auth-architecture-remediation.md) — خطة بنية الصفحات وحالات الضيف والمستخدم المسجّل، من مجلد `plans/` السابق.

## الاختبارات والأرشيف

- [testing/evidence/2026-10-09-auth-login/README.md](./testing/evidence/2026-10-09-auth-login/README.md) — تقرير التحقق المحلي لتسجيل الدخول وصوره الأصلية.
- [archive/project-memory.md](./archive/project-memory.md) — وصف تاريخي لأنظمة الذاكرة، من `MEMORY.md` السابق؛ يُراجع مصدر كل ادعاء قبل الاعتماد عليه.

## Superpowers (specs + plans + investigations)

- [superpowers/](./superpowers/) — specs، plans، investigations مولّدة أثناء الجلسات الطويلة.
  - `specs/` — تصميم تفصيلي لميزات (e.g. reports-rebuild، booking flow).
  - `plans/` — خطط تنفيذ مع milestones.
  - `audits/` — تقارير إضافية.

## CI / Docker

- [../.github/workflows/merge-gate.yml](../.github/workflows/merge-gate.yml) — تعريف فحوص الدمج (OpenAPI drift، Prisma migration immutability، api-client drift، Gitleaks).
- [../.github/retired-workflows/README.md](../.github/retired-workflows/README.md) — وصف workflows المتقاعدة وحدود الاعتماد عليها.
- [../docker/](../docker/) — Docker Compose files للإنتاج + dev، nginx، postgres init scripts، Redis config.

## الملاحظات

- `.gitignore` يسمح بمسارات الوثائق المعتمدة فقط. بعض الروابط التاريخية أعلاه تشير إلى وثائق محلية متجاهلة وقد لا تتوفر في نسخة مستنسخة جديدة.
- التقرير التاريخي لا يثبت الحالة الحالية أو نجاح نشر؛ الأدلة التشغيلية والإصدارات لها سجلات مستقلة.
