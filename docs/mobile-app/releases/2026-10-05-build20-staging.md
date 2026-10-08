# TestFlight 1.0.0 (20) — الاستيج — 2026-10-05

متاح ضمن **Sawaa Internal** بمختبر واحد. تحقق Apple عند **22:29 بتوقيت الرياض**: `VALID` و`IN_BETA_TESTING` و`usesNonExemptEncryption=false`. حُفظت ملاحظات الاختبار العربية وأُعيد فتح الصفحة للتحقق من المجموعة والملاحظات. البيئة هي **الاستيج** وفق اختيار المالك: `https://staging.sawaa.sa/api/v1`.

## المصدر والدمج

- دُمجت جميع التغييرات المراجعة عبر [PR #158](https://github.com/tariiq222/sawaa/pull/158)؛ `develop` المحلي و`origin/develop` عند `f3b24c25dbbdd1df31b860ec44750c27db5719c2`. فحصا GitHub `gate` و`critical-real-e2e` ناجحان؛ لم توجد PRs مفتوحة عند التحقق النهائي.
- يتضمن المصدر التسجيل المتأخر للجلسات، إصلاحات الأمان، متابعة الزائر، تصميم الموعد والخلفيات، والدفع الأصلي. [أدلة قبول المصدر المدمج وحدودها](../../operations/integrations/2026-10-05-all-branches.md).
- بُني نفس المصدر مع إضافة مؤقتة موثقة في `eas.json` لملف `testflight-staging`، وقناة `staging`، وعنوان API الاستيج ومعرّف Apple Pay. استُخدمت بيئة EAS المسماة `production` لملف Firebase الموجود؛ أكد فحص IPA أن عنوان API الفعلي هو الاستيج وأن عنوان الإنتاج غائب. لم يتغير ملف production الدائم أو متغيرات الحساب.
- طابقت 698 ملفات مصدر أرشيف EAS؛ استُبعدت ملفات البيئة الفعلية والأسرار ومراجع التوقيع. أُعيد ملف `eas.json` الأصلي بعد التسليم وحُفظ مرجع التوقيع المحلي في مساحة الأدلة الخاصة.

## البناء والتوقيع والتسليم

- [EAS build 20](https://expo.dev/accounts/tariq222/projects/sawa/builds/71fb8f34-a67b-43a8-8eb7-aff80c167a70): `FINISHED` عند 19:20:05 UTC؛ الإصدار `1.0.0`، الحزمة `sa.sawa.app`، الفريق `569M49FYA6`، SDK `iphoneos26.2`.
- نجح ZIP و`codesign --verify --deep --strict`؛ `get-task-allow=false` وpush `production` وApple Pay merchant `merchant.sa.sawa.app`. تتبع بيئة push نوع توزيع Apple، بينما يستهدف التطبيق API الاستيج.
- ملف التوقيع المحدث `Sawaa TF Staging Apple Pay 20261005` فعّال ويضم Apple Pay، مع شهادة التوزيع الموجودة. أُلغي بناء EAS 19 قبل الرفع لأنه استخدم الملف القديم الذي ظهر `INVALID`؛ لم يُرفع البناء 19 إلى Apple، ولم تُلغَ شهادة أو يُنشأ مفتاح وصول جديد.
- يحتوي IPA على PassKit ومسارات الدفع الأصلي وموافقة الإلغاء، وصورتي الخلفية المطابقتين للمصدر وخطوط IBM العربية الخمسة.
- IPA SHA-256: `ef7c7325387f2f9eb193166d4f30fa2d0529c918c61eb0d758f47c47bfb83ffa`.
- نجح رفع `altool` مرة واحدة عند 19:24:31 UTC؛ Apple build / delivery UUID: `83d44bd1-e836-4aa2-8bfc-3082c47126cd`. [تفاصيل TestFlight](https://appstoreconnect.apple.com/apps/6815632181/testflight/ios/83d44bd1-e836-4aa2-8bfc-3082c47126cd).
- الأدلة المحلية الخاصة: `/Users/tariq/.codex/release-evidence/2026-10-05-all-pr-testflight/`، خاصة `verified.json` و`source-manifest.json` و`upload-result.json` و`delivery.json` و`apple-final.json` و`apple-testflight20.png`. لا تنقل ملفات التوقيع أو المفاتيح إلى Git.

## التحقق وحدوده

اجتاز المصدر المدمج 1,272 اختبار جوال ضمن القبول السابق وGitHub CI؛ بعد اختيار عنوان الاستيج اجتازت اختبارات إعداد البيئة المركزة الخمس. تحققت استجابة health/ready للاستيج، ووجود مسار إعداد الدفع المحمي، وتطابق ملفي عقد الدفع المترجمين مع المصدر، وتطبيق migrations الجديدة الثلاث. هذه أدلة محددة للخادم؛ ليست إثباتًا لمراجعة المالك لكل الاستيج أو تطابق كل حاوياته مع commit واحد.

لم يُختبر هذا IPA على جهاز فعلي بعد؛ Apple Pay و3DS وpush على الجهاز وAndroid والقبول اليدوي للاستيج باقية للاختبار. لم يُرقّ هذا الإصدار إلى `main` أو خادم الإنتاج، ولم يُرسل البناء 20 إلى App Review أو يُستبدل البناء السابق هناك. السجل المحلي لهذا التسليم أُضيف بعد بناء IPA ولا يغيّر محتوى البناء الموقّع.
