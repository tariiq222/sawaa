# Sawa Documentation

هذا المجلد يحتوي على وثائق المشروع الإضافية خارج `CLAUDE.md` الجذر و CLAUDE.md الخاص بكل تطبيق.

## الأدلة التشغيلية (Operations)

- [DOKPLOY-SETUP.md](./DOKPLOY-SETUP.md) — إعداد النشر على Dokploy (production، منافذ Docker 5100/5103/5105).
- [operations/restore-runbook.md](./operations/restore-runbook.md) — إجراءات استعادة النسخ الاحتياطية (Postgres + MinIO + Env).
- [../apps/backend/docs/operations/p2-credential-rekey-2026-05-09.md](../apps/backend/docs/operations/p2-credential-rekey-2026-05-09.md) — إجراء تدوير مفاتيح تشفير الـ credentials.

## القرارات المعمارية (ADRs)

- [adr/](./adr/) — Architecture Decision Records
  - [financial-money-unit-halalas.md](./adr/financial-money-unit-halalas.md) — ADR-001: اعتماد integer halalas كوحدة تخزين للنقود.

## تقارير التدقيق (Audits)

ملفات تاريخية — Snapshot بنتائج جلسات التدقيق. لا تُعدّل بعد إنشائها إلا لتوضيح التصحيحات اللاحقة.

- [audits/2026-06-21-backend-audit.md](./audits/2026-06-21-backend-audit.md) — تدقيق الـ Backend (يونيو 2026).
- [audits/2026-06-29-website-integration-audit.md](./audits/2026-06-29-website-integration-audit.md) — تدقيق تكامل الـ Website (يونيو 2026).
- [security-test-report-service-module.md](./security-test-report-service-module.md) — تقرير اختبار أمان الـ Service module.
- [system-analysis-report-2026-07-09.md](./system-analysis-report-2026-07-09.md) — تحليل شامل للنظام (9 يوليو 2026 — **المرجع الأحدث**).

## الخطط (Plans)

- [plans/session-packages-rebuild.md](./plans/session-packages-rebuild.md) — خطة إعادة بناء حزم الجلسات.

## Superpowers (specs + plans + investigations)

- [superpowers/](./superpowers/) — specs، plans، investigations مولّدة أثناء الجلسات الطويلة.
  - `specs/` — تصميم تفصيلي لميزات (e.g. reports-rebuild، booking flow).
  - `plans/` — خطط تنفيذ مع milestones.
  - `audits/` — تقارير إضافية.

## CI / Docker

- [../.github/workflows/ci.yml](../.github/workflows/ci.yml) — بوابة الـ CI (OpenAPI drift، Prisma migration immutability، api-client drift، Gitleaks).
- [../.github/workflows/nightly-e2e.yml](../.github/workflows/nightly-e2e.yml) — e2e nightly flows.
- [../docker/](../docker/) — Docker Compose files للإنتاج + dev، nginx، postgres init scripts، Redis config.

## الملاحظات

- `docs/` في `.gitignore` مع whitelist للأدلة أعلاه — باقي الـ docs (مثل تجارب شخصية) لا يُلتزم.
- التقارير التاريخية (`fix-report-*`، `verification-report-*`) محفوظة في git history — لا حاجة لوجودها في الـ tree الحالي.