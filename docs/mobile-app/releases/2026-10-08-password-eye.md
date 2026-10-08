# أيقونة إظهار كلمة المرور — 2026-10-08

تعديل محلي على `develop` عند `5855a2bdc`: استبدال زر إظهار/إخفاء كلمة المرور المنفصل في شاشة الدخول بأيقونة العين داخل `LabeledInput` المشترك. الأيقونة والنص عنصران منفصلان في صف الحقل؛ مساحة الأيقونة لا تقل عن 44×44، والنص يستخدم المساحة المتبقية. تبقى تسمية الإظهار/الإخفاء متاحة لقارئ الشاشة، ويتعطل الزر أثناء طلب الدخول.

الملفات: `apps/mobile/app/(auth)/login.tsx` واختباره `apps/mobile/app/(auth)/__tests__/password-login.test.tsx`. حُفظت تعديلات التوثيق السابقة كما هي.

التحقق المحلي:

- نجح `pnpm --dir apps/mobile exec jest --runInBand --coverage=false --runTestsByPath 'app/(auth)/__tests__/password-login.test.tsx' components/ui/__tests__/LabeledInput.test.tsx`: مجموعتان و16 اختبارًا، بما فيها تبديل الإظهار والإخفاء والاحتفاظ بقيمة الحقل.
- نجح `pnpm --dir apps/mobile typecheck`.

لم يُختبر هذا التعديل بصريًا على محاكي أو جهاز فعلي. وافق المالك على حفظه في commit محلي على `develop`؛ لا push أو بناء أو رفع TestFlight جديد، وليس ضمن البناء27 الموجود.
