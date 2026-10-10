# متابعة مراجعة الكتالوج — عيبا صور P2

الأساس المحلي: `06d949e7a60f76bc388834638fdb03a23931c12e`. النطاق حصريًا نموذج عائلة الباقات ونموذج الخدمة واختباراتهما. لا تعديل registry أو OpenAPI/generated types أو backend أو بيانات حية.

| الملاحظة | السبب والإصلاح | الدليل |
|---|---|---|
| رفع صورة عائلة الباقات يعيد draft قديمًا ويلغي تعديلات الاسم/الخيارات أثناء الانتظار. | callback اكتمال الرفع كان يغلق على `value` عند بداية الرفع. في `components/features/packages/package-family-editor.tsx` أضيف ref للمسودة، يتحدث تزامنيًا مع كل update؛ يدمج callback مفتاح الصورة وحده مع أحدث ref ثم يستعمل update نفسه، مع استمرار onChange. | `test/unit/components/features/packages/package-family-editor.spec.tsx`: يبدأ رفعًا معلّقًا، يغير الاسم وينسخ خيارًا، يكمل الرفع؛ يبقى الاسم الجديد والخياران في الحقول وonChange وonSubmit، مع storageKey الصحيح. |
| تعديل الخدمة يرسل `blob:` ضمن PATCH العام قبل رفع الملف؛ فشل الرفع يستبدل الصورة القديمة بمعاينة المتصفح. | spread الخاص بـimageUrl كان يلغي حارس blob في buildServiceEditPayload. في `components/features/services/service-form-page.tsx` يحذف الحقل حين يوجد ملف معلّق أو blob preview أو صورة signed غير متغيرة. يبقى null للمسح الصريح. | `test/unit/features/catalog/catalog-service-form.test.tsx`: اختيار ملف، general update، رفض الرفع؛ PATCH لا يحتوي imageUrl بعد JSON serialization ولا blob؛ نموذج persistence في mock يبقي المفتاح القديم ولا يحدث redirect. ويختبر blob دون ملف، null للمسح، وsigned URL غير المتغير. |

جميع المسارات في الجدول نسبية إلى `apps/dashboard/`. اختبارات service-form تستخدم الشكل الحقيقي للنموذج مع mock لعملية الحفظ والرفع؛ لا تتصل بقاعدة بيانات. اختبار العائلة يستعمل image-field الحقيقي وPromise رفع مؤجلًا.

## RED / GREEN

- RED على الأساس: الاختباران الجديدان أعادا إنتاج فقد تعديل العائلة وإرسال blob مع فشل رفع الخدمة؛ اختبار fallback لblob دون ملف كشف المسار نفسه أيضًا. النتيجة **3 فشل / 12 نجاح** في ملفين؛ `/tmp/catalog-review-red.log`.
- GREEN بعد الإصلاح: **16 اختبارًا ناجحًا في 3 ملفات**، بما فيها الاختبارات القديمة للمحرر وimage-field؛ `/tmp/catalog-review-green.log`.
- لم تتغير طبقة الرفع أو تخزين الملفات؛ الإصلاح يمنع payload المتصفح المؤقت ويحافظ على أحدث draft.

الأمر، عبر wrapper البيئة الاصطناعية `run-safe.mjs`:

```sh
pnpm --dir apps/dashboard exec vitest run test/unit/components/features/packages/package-family-editor.spec.tsx test/unit/features/catalog/catalog-service-form.test.tsx test/unit/features/catalog/catalog-image.test.tsx
```

## التحقق المحدد

- ESLint للملفين المعدلين واختباراتهما: نجاح، بلا أخطاء أو تحذيرات؛ `/tmp/catalog-review-lint.log`.
- TypeScript program بجذور الملفات الأربعة المعدلة وtest/setup الموجود: **0 تشخيص في الجذور المعدلة، وخطآن في dependency `lib/api/departments.ts`** من generated schema القديم الذي لا يسمح nullable descriptions. فحص شجرة imports يخرج بالفشل بسببهما؛ لا يُدّعى نجاح typecheck كامل. السجل `/tmp/catalog-review-types-final.log`. توليد OpenAPI/types والفحص المتكامل يملكهما المنسق. محاولة أولية أدرجت next-env.d.ts غير الموجود صراحةً؛ أزيل من قائمة الجذور ولم يُنشأ ملف بيئة أو يُعدّل generated.
- `git diff --check`: نجاح.
- لا suite أو build أو lint شامل، ولا push/merge/deploy أو تغيير بيانات. smoke والتحقق المتكامل لدى المنسق.

أمر lint:

```sh
pnpm --dir apps/dashboard exec eslint components/features/packages/package-family-editor.tsx components/features/services/service-form-page.tsx test/unit/components/features/packages/package-family-editor.spec.tsx test/unit/features/catalog/catalog-service-form.test.tsx
```
