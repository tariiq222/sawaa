# سواء — Woodpecker المحلي

اختار المالك في 2026-09-30 نقل CI من GitHub Actions إلى Woodpecker المحلي. إعداد GitHub Actions معطّل على المستودع، ولا تُفسَّر فحوصه القديمة المحجوبة بالميزانية على أنها فشل في كود النسخة الجديدة. وفي المقابل لا يُسمح بالدمج قبل نجاح الفحوص البديلة كاملة.

## نطاق التشغيل

- Woodpecker CLI الرسمي 3.18.0 على الجهاز، مع `backend=local` وصدفة Bash.
- السكربت يشغّل الاختبارات في حاويات Linux داخل `woodpecker-local-engine-1`، وهو محرك rootless منفصل عن حاويات التطوير.
- تُحفظ حزم pnpm وملفات متصفح Playwright في وحدتي cache داخل المحرك المعزول لإعادة استخدامها؛ بيانات الاختبار والمصدر مؤقتة لكل تشغيل.
- لكل تشغيل قاعدة PostgreSQL وRedis وMinIO وحاوية تنفيذ مستقلة، بلا منافذ على المضيف. يستخدم outbox حاوية Redis اختبارية خاصة به.
- لا تدخل ملفات `.env` أو بيانات اعتماد حقيقية أو تعديلات مجلد العمل الرئيسي إلى التشغيل. الأسرار داخل بيئة الاختبار اصطناعية.
- تبقى خدمة Woodpecker ومشغّل المشاريع الأخرى دون تعديل. CLI يعمل محليًا؛ لا يعني ذلك أن webhook من GitHub إلى localhost يعمل أو أن نتيجة ظهرت في واجهة Woodpecker تلقائيًا.

## الفحوص المطلوبة قبل الدمج إلى develop

| المسار السابق | البديل المحلي المطلوب |
|---|---|
| backend | startup contract، ثبات migrations، توليد Prisma، lint/types، unit وE2E، عقد OpenAPI وapi-client |
| critical-real-e2e | اختبارات قاعدة فعلية مع التحقق من عدم تخطي المجموعات المطلوبة |
| outbox-transport | Redis مستقل واختبارات إعادة التشغيل/فشل النقل |
| dashboard | توليد الأنواع وdrift، lint/types/unit/build وترجمات |
| dashboard-smoke | backend مبني وقاعدة اختبار مبذورة وPlaywright فعلي |
| website | lint/types/unit/build لحزمة `@sawaa/website` |
| mobile | تثبيت workspace منفصل، shared، lint/types واختبارات بتغطية |
| security | pnpm audit وGitleaks وTrivy مع حفظ النتائج وتنقيح الأسرار |
| semgrep/oss-scan | Semgrep CE بالقواعد والأعلام المثبتة نفسها |
| release-integrity | اختبارات عقد الإصدار وسجل النشر |

## التشغيل اليدوي المحلي

يلزم checkout مستقل نظيف تمامًا عند commit المرشح بكامل تاريخ Git (مجلد `.git` فعلي، لا worktree مرتبط)، مع `origin/develop` عند أساس الطلب. قبل أول تشغيل جهّز صورة MinIO Linux من الإصدار المثبّت باستخدام `bash scripts/ci/prepare-minio.sh`؛ السكربت يحتاج Go وPython3 على المضيف؛ يترجم ملف Linux على المضيف ثم يبني صورة الحاوية داخل محرك CI المعزول. لا يشغّل خدمة MinIO على المضيف. ثم شغّل من النسخة المستقلة:

```bash
/Users/tariq/.local/share/woodpecker-local/bin/woodpecker-cli \
  --disable-update-check exec --local --backend-engine local \
  --repo-path "$PWD" --pipeline-event pull_request \
  --commit-branch develop \
  --commit-sha "$(git rev-parse HEAD)" --timeout 3h .woodpecker/ci.yml
```

أداة CLI مثبتة من إصدار 3.18.0 الرسمي بعد مطابقة SHA256 بملف checksums المنشور. `skip_clone` مقصود في هذا المسار اليدوي: المسؤول يجهز النسخة المستقلة أولًا. لا ترسل هذا التعريف إلى مشغّل الخادم بوصفه تشغيلًا تلقائيًا قبل إعداد مرحلة جلب المصدر.

السكربت يطبع مجلد النتائج عند الانتهاء؛ الافتراضي مجلد شقيق لنسخة المصدر: `../sawaa-ci-artifacts/<run-id>/` (خارج HOME المؤقت الذي يحذفه Woodpecker)، ويمكن تعيين `SAWAA_CI_ARTIFACT_DIR` عند التشغيل المباشر للسكربت. يتضمن `phases.tsv` و`gates.exitcode` و`launcher.exitcode` وبصمات المصدر وملفات التقارير. أي FAIL أو BLOCKED يمنع قبول التشغيل.

## دليل القبول

يُرفض أي مصدر بتعديلات غير مودعة أو ملفات غير متتبعة. احفظ SHA المصدر وSHA أساس PR، أثر شجرة المصدر المختبرة، سجل كل مرحلة، رمز الخروج النهائي والملفات الناتجة. لا تكفي نتيجة جزئية أو تقرير قديم. بعد تعديل المرشح تصبح نتيجة النسخة السابقة غير كافية لاعتماد النسخة الجديدة.

الدفع الحقيقي وظهور التطبيق على الجهاز وقبول المالك للتجريب تبقى أدلة منفصلة. نقل CI لا ينشر التطبيق، ولا يجيز دمج `main` أو تجاوز موافقة الإنتاج.

## حالة الانتقال

دليل القبول لكل مرشح هو سجل PR ومجلد نتائج CLI الكامل المشار إليه فيه، بما فيه SHA ورمز الخروج. وجود هذا الإعداد وحده لا يثبت نجاح النقل أو تشغيل المرشح. نُقلت مسارات GitHub الخاصة بفحوص develop إلى `.github/retired-workflows/` وحُفظت مرجعًا؛ إعداد المستودع يمنع GitHub Actions حاليًا. فحوص main الإضافية وجدولة E2E الليلية وإنشاء release/tag ليست دليل قبول ضمن تشغيل develop هذا.
