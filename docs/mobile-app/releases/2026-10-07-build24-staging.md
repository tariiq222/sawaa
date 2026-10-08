# TestFlight 1.0.0 (24) — الاستيج — 2026-10-07

أُتيح البناء 24 لمجموعة Sawaa Internal الحالية (مختبر واحد). رصد Apple API عند 07:57:58 UTC: `processingState=VALID` و`internalBuildState=IN_BETA_TESTING` و`usesNonExemptEncryption=false`. حُفظت ملاحظات الاختبار بالعربية. هذا إصدار للاستيج؛ لم يُرسل إلى App Review ولم يُنشر إلى الإنتاج. تجربة الإصدار على iPhone وقبول المالك ما زالا مطلوبين.

## التغييرات والمصدر

- الدخول مباشرة بالبريد أو الجوال وكلمة المرور، مع خيار رمز التحقق وإنشاء/استعادة كلمة المرور. [السلوك والتغطية](2026-10-07-password-login.md).
- يتضمن تغييرات البريد والحجز والدفع المدموجة في develop؛ Apple Pay محفوظ ومهيأ في الاستيج، ولا يوجد إثبات جديد لعملية Apple Pay على جهاز فعلي.
- معالجة تنبيهات اعتماديات الإصدار: shell-quote 1.11.0، @modelcontextprotocol/sdk 1.31.0، sharp 0.35.5 وlibvips 1.3.4. استثناءات Gitleaks محددة ببصمات كلمة مرور اختبار اصطناعية فقط.
- [PR #165](https://github.com/tariiq222/sawaa/pull/165) مدموج. مصدر البناء `2d346a8bef5f5cd50274bf0369d1bca709131a3c`؛ commit الدمج المنشور `53c9001d7dbb0e0fbe39547bedcd26654aeab04f` وله الشجرة نفسها.

## التحقق والنشر

- [CI النهائي](https://github.com/tariiq222/sawaa/actions/runs/37586249869): نجاح gate وcritical-real-e2e وSecret Scan وTrivy وMobile Unit.
- التحقق السابق للمصدر: 8811 اختبار خادم، 1343 اختبار جوال، و41 Dashboard Smoke ناجحة. تحقق الإصدار المركز: 22 اختبار جوال؛ وبعد تحديث الاعتماديات 71 اختبارًا وفحص الأنواع وفحص sharp/SVG وshell-quote ناجحة.
- نشر الاستيج `dep_1UIc-Gh1-6zoZv-d`: Ready، ست خدمات سليمة، health 200. password-login يعيد 400 للمدخلات الفارغة و401 لهوية اختبار غير موجودة. فحوص مدخلات البريد غير الصالحة 400. هويات حاويات الإنتاج لم تتغير.
- تعثرت أول محاولة لنشر dashboard بمهلة Docker session؛ نجحت إعادة نشر الخدمة المتعثرة. لا تغييرات بيانات إنتاج أو migrations.

## البناء والرفع

- EAS: `8b84e037-c810-4cf0-869a-4982bf045749`، FINISHED، profile `testflight-staging`.
- iOS SDK 26.2، bundle `sa.sawa.app`، team `569M49FYA6`، `get-task-allow=false`، push production، merchant `merchant.sa.sawa.app`.
- تم فحص التوقيع، IPA، تطابق المصدر والأرشيف، وجود عنوان الاستيج وغياب عنوان API الإنتاج، PassKit وخطوط IBM وأصول الخلفيات.
- IPA SHA256: `7d304f28dbadf3e0ce538d406da95113f70afe79f8a4aba1de0417b8419ddf99`.
- Apple delivery/build UUID: `63cd8a59-af6f-4cf0-ba21-a1b3831b3973`. نجح altool عند 10:50:01 بتوقيت الرياض، ثم اكتملت المعالجة والإتاحة الداخلية.
- البناء 23 استُبدل بالبناء 24 بعد تحديث الاعتماديات ولم يُرفع إلى Apple.
- أعيد eas.json بعد overlay الاستيج المؤقت، وحُذف ملف credentials المؤقت. لا مفاتيح أو signed URLs في هذا السجل.

## الأدلة والقبول اليدوي

الأدلة المحلية: `/Users/tariq/.codex/release-evidence/2026-10-07-password-testflight/`؛ البناء النهائي تحت `build24/` ويشمل verified.json وupload-result.json وapple-builds.json وbuild24-available.png. الاستيج موثق في staging-acceptance.json وstaging-ready.png.

افتح TestFlight وحدّث إلى 24، ثم اختبر الدخول بكلمة المرور وبالرمز، إنشاء/استعادة كلمة المرور، استكمال الحجز واستعادة الجلسة. اختبر الدفع بالمركز وApple Pay على جهاز يدعمه ضمن البيئة التجريبية. لا تساوي الإتاحة نجاح التثبيت أو قبول الجهاز أو مراجعة Apple. قياس استهلاك المهمة غير مكتمل؛ لا ادعاء بإجمالي أو توفير.
