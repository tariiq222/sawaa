# إصدار TestFlight — 2026-10-02

## المصدر والنطاق

- طلب المالك بناء نسخة جديدة ورفعها إلى TestFlight بالإصلاحات الحالية.
- المصدر: `5c56e7b80af70a0a05228964e3187607e593fc38`، الفرع المحلي `codex/local-develop-integration-20261002`، مع تعديل تعليق موجود مسبقًا في `apps/mobile/lib/package-vat.ts`.
- يشمل إصلاحات ما بعد البناء 14: إعادة إرسال رمز التسجيل، متابعة وإعادة محاولة الدفع، السجلات والتنقل العام، هوية الخدمة المحجوزة، شراء الباقات وثبات الموعد، الملف الشخصي والقوائم العامة، عرض سعر الباقة مع الضريبة المضبوطة، وتحديثات الاعتماديات.
- تحرّك HEAD أثناء الانتظار إلى `5ef3bfa14` من عمل متزامن؛ أكد manifest النهائي بقاء جميع ملفات الجوال وshared الـ605 مطابقة للأرشيف.
- لم تنفذ هذه الجلسة commit أو push أو دمج أو نشرًا للخادم. يحتوي المستودع إصلاحات خادم أيضًا؛ رفع التطبيق وحده لا يثبت نشرها أو توافقها الحي مع خادم الإنتاج.

## الفحوص الجديدة

- `pnpm --dir apps/mobile test --runInBand`: نجاح 159 مجموعة / 1030 اختبارًا مع التغطية، exit 0.
- `pnpm --dir apps/mobile typecheck`: نجاح، exit 0.
- `pnpm --dir apps/mobile lint`: صفر أخطاء و5 تحذيرات، exit 0.
- `git diff --check`: نجاح.
- فحص EAS archive: تطابق 605 ملفات متتبعة من الجوال وshared مع نسخة العمل؛ لا مفاتيح p8/p12 أو private-config أو ملفات بيئة فعلية. حُفظ manifest SHA-256 محليًا، ولم يتغير المصدر عند إعادة الفحص بعد بدء البناء.

## البناء والتسليم

- EAS: [b431626b-1d55-4579-ab7a-fcf6133a26c3](https://expo.dev/accounts/tariq222/projects/sawa/builds/b431626b-1d55-4579-ab7a-fcf6133a26c3).
- الإصدار `1.0.0 (15)`، bundle `sa.sawa.app`، profile/environment `production`.
- اكتمل EAS بنجاح؛ Xcode 26.2 / SDK iOS 26.2، والحد الأدنى iOS 15.1. نجح تثبيت frozen-lockfile الأولي؛ نفّذ Expo prebuild لاحقًا تثبيتًا بـno-frozen-lockfile ضمن توليد المشروع الأصلي.
- Expo Doctor: 18/20؛ تنبيه تثبيت `expo-modules-core` مباشرة، وتنبيه `expo-updates` المثبت 55.0.31 مقابل المتوقع ~55.0.33. لم يمنعا اكتمال البناء؛ لم تُغيّر الاعتماديات في جلسة الإصدار.
- IPA: ZIP والتوقيع `codesign --verify --deep --strict` ناجحان، bundle/version/build/team مطابقة؛ `get-task-allow=false` وpush=`production`. عنوان API الإنتاج وFirebase موجودان في الحزمة. SHA-256: `aafb9aa0c22ae2588f948fb731a242be0af375eaaa525e2765bb06107d72c648`.
- نجح رفع Apple بـ`altool` في 14:54 الرياض، delivery UUID: `e4c4d960-0c02-418f-b325-341432f13f36`، exit 0 ودون أخطاء. اكتملت المعالجة `VALID`. حُفظ إقرار `usesNonExemptEncryption=false` من واجهة Apple وفق الإقرار السابق دون تغيير استخدام التشفير. حُفظ What to Test بالعربية، وأضيف البناء إلى `Sawaa Internal` بـHTTP 204؛ أكدت القراءة اللاحقة `IN_BETA_TESTING` وظهرت المجموعة بمختبر واحد في الواجهة. [صفحة البناء](https://appstoreconnect.apple.com/apps/6815632181/testflight/ios/e4c4d960-0c02-418f-b325-341432f13f36).
- اختبار البناء النهائي على جهاز فعلي: غير متحقق. لا App Review أو نشر عام.

## الأدلة

- سجلات الفحص والبناء وmanifest محليًا: `/tmp/sawaa-testflight-20261002/`؛ مجلد مؤقت وليس أرشيف أدلة دائمًا. لا تنسخ روابط التنزيل المؤقتة أو ملفات الاعتماد إلى Git.
- روجعت [إرشادات رفع Apple](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds) و[TestFlight](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/) في 2026-10-02.
- قياس الاستخدام وفق `astra-effort-v1` غير مكتمل: baseline متأخر، وتعذر إرفاق المنسق بسبب `KeyError: participants` في أداة receipts؛ لا استنتاج لاستهلاك المهمة الكامل أو وفر الحصة.
