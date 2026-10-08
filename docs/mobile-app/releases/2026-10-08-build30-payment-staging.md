# TestFlight 1.0.0 (30) — إصلاحات الدفع للاستيج — 2026-10-08

الحالة: **1.0.0 (30) متاح ضمن Sawaa Internal** (`IN_BETA_TESTING`)، متصل بالاستيج، لتجربة Apple Pay على جهاز فعلي. هذا تسليم داخلي وليس قبول جهاز أو مزود.

## المصدر

فرع `codex/mobile-payment-e2e` (PR 170 إلى `develop`) عند الكود `c25574c2c` الذي يضم إصلاحات مراجعات الدفع وإصلاح `PaymentResponse.complete()` في patch حزمة Moyasar SDK. لا commit خاص بالبناء؛ ملف `testflight-staging` مؤقت لم يُلتزَم.

## البناء والتسليم

- EAS `83051c27-d130-4640-94e9-0a6d7ecf4477`، الإصدار 1.0.0، رقم البناء الفعلي 30. محاولتان سابقتان بُنيتا برقم 28 وفشلت لأن ملف التوقيع المحلي القديم (`Sawaa App Store 20260924`) لا يحوي Apple Pay؛ أعيد بملف `Sawaa TF Staging Apple Pay 20261005` الصالح حتى 2027-09-24.
- فحص الـ IPA: ZIP وcodesign strict سليمان، `CFBundleIdentifier=sa.sawa.app`، الفريق `569M49FYA6`، `get-task-allow=false`، `aps-environment=production`، تاجر `merchant.sa.sawa.app`، SDK `iphoneos26.2`. الحزمة تحوي API الاستيج `https://staging.sawaa.sa/api/v1` فقط ولا عنوان إنتاج ولا مرجع fixture.
- IPA SHA256: `72b885c95dd8cece42fb64fc3a2dab6b5dff18a8c68d7de583f51fb96b3ea7d4`.
- رُفع بالمفتاح المحلي عبر altool؛ Apple delivery UUID وbuild ID: `ad188290-753c-45ea-baa2-6900bc8a7048`. `VALID` ثم أُجيب إقرار التشفير بـ«None of the algorithms mentioned above» (القرار السابق للمالك؛ رفض المفتاح المحلي PATCH بـ403 فأُكملت الخطوة من جلسة المالك في App Store Connect)، وحُفظت ملاحظات الاختبار بالعربية، وأُضيف إلى `Sawaa Internal` وصار `IN_BETA_TESTING`.

## الفحوصات المحلية قبل البناء

من `apps/mobile`: typecheck وlint ناجحان، `pnpm test` ناجح (226 مجموعة و1680 اختبارًا). `merge-gate` على GitHub نجح لآخر commit كود. e2e على المحاكي (7 من 7) كان على commit أسبق.

## ما لم يُتحقق منه

- Apple Pay على الآيفون بهذا البناء: ورقة Wallet، والإلغاء، وانتهاء الحجز أثناء فتحها، وحارس التحويل البنكي (السيناريوهات في ملاحظات الاختبار).
- Moyasar sandbox بعد التغييرات، وشراء الباقة (الكتالوج فارغ)، وdashboard smoke.
- لا إرسال App Review ولا نشر backend أو إنتاج.
