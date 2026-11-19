// Website dictionary — feature group: legal.
// `en` is typed as Record<keyof typeof ar, string>: a missing or
// extra English key is a TypeScript error.
import type { LocalizedDictionary } from './dictionary.types';

const ar = {
  'legal.lastUpdated': 'آخر تحديث: مايو ٢٠٢٦',
  'legal.reviewNotice':
    'تنبيه: هذه الصياغة أولية لأغراض التوضيح، وتخضع للمراجعة والاعتماد النهائي من مستشار قانوني مرخّص في المملكة العربية السعودية قبل الإطلاق الرسمي.',
  'legal.privacy.lastUpdated':
    "آخر تحديث: ٤ أكتوبر ٢٠٢٦",
  'legal.privacy.consent.title':
    "المسوغ النظامي والموافقة",
  'legal.privacy.consent.body':
    "نعالج البيانات على أساس الموافقة، أو تنفيذ اتفاق تكون طرفًا فيه، أو التزام نظامي، بحسب طبيعة البيانات والغرض المعلن. عندما تكون الموافقة أساس معالجة البيانات الحساسة، نطلب موافقة صريحة قابلة للإثبات قبل المعالجة؛ لا يُعد مجرد الاطلاع على السياسة موافقة مستقلة عليها. يمكنك العدول عن الموافقة عبر بيانات التواصل أدناه، وإيقاف الأذونات من إعدادات جهازك. لا يؤثر العدول في مشروعية المعالجة السابقة، وقد يترتب عليه تعذر استمرار الخدمة التي تعتمد على تلك المعالجة، مع مراعاة الاحتفاظ المفروض نظامًا.",
  'legal.privacy.sharing.title':
    "الجهات التي تتلقى البيانات",
  'legal.privacy.sharing.body':
    "يقتصر الوصول داخل المركز على المختصين والموظفين المخولين بحسب حاجتهم لأداء مهامهم. ونشارك الحد اللازم من البيانات مع مزودي الاستضافة والتخزين، والدفع مثل Moyasar، والجلسات عن بعد مثل Zoom، وخدمات الرسائل والبريد والإشعارات مثل Firebase، ومراقبة الأعطال مثل Sentry أو GlitchTip، بحسب الخدمات المشغلة فعلًا. يخضع مزودو المعالجة لالتزامات سرية وأمان وحدود استخدام تحقق حماية مساوية لما تتطلبه هذه السياسة والأنظمة المنطبقة. وقد نفصح عن بيانات لجهة مختصة إذا كان الإفصاح مطلوبًا نظامًا. لا نبيع البيانات الشخصية، ولا نستخدم البيانات الصحية أو النفسية للإعلانات أو التسويق أو التتبع الإعلاني. وأي تواصل تسويقي اختياري يتطلب الأساس والموافقة النظامية الخاصة به وإمكانية إيقافه.",
  'legal.privacy.payment.title':
    "الدفع",
  'legal.privacy.payment.body':
    "تُعالج عمليات الدفع عبر مزود الدفع المختص، بما في ذلك Apple Pay حين يتوفر. يحتفظ المركز بما يلزم لإثبات المعاملة وإدارة الفواتير والاسترداد، مثل المبلغ وحالة الدفع والمرجع، وقد تتضمن الاستجابة نوع وسيلة الدفع والبيانات المقنّعة. وتُعالج المرفقات التي ترفعها لإثبات التحويل لهذا الغرض؛ يرجى عدم إرفاق بيانات مالية لا حاجة لها.",
  'legal.privacy.permissions.title':
    "الجلسات عن بعد وأذونات الجهاز",
  'legal.privacy.permissions.body':
    "تتطلب الجلسة عن بعد معالجة الصوت والصورة والاسم وبيانات الاتصال اللازمة عبر مزود الجلسة. نطلب أذونات الكاميرا والميكروفون عند استخدام الميزة، وأذونات الصور لاختيار المرفقات، والإشعارات لإرسال التنبيهات عند تفعيلها. يمكنك التحكم في هذه الأذونات من إعدادات جهازك. استخدام الكاميرا أو الميكروفون لإجراء جلسة لا يُعد في ذاته موافقة على تسجيلها أو استخدامها لغرض آخر.",
  'legal.privacy.ai.title':
    "المساعد الذكي الاختياري",
  'legal.privacy.ai.body':
    "قد يُتاح مساعد اختياري في الموقع للمعلومات والمساعدة في الخدمة. عند تشغيله، تعالج الخدمة الرسائل وتاريخ المحادثة وسياقًا متعلقًا بطلب الخدمة باستخدام OpenRouter ومزوّد النموذج المختار. مشاركة البيانات الشخصية مع خدمة ذكاء اصطناعي خارجية تستلزم بيان المزود والبيانات المرسلة والغرض والحصول على موافقة صريحة قبل المشاركة؛ ولا يُعد الاطلاع على هذه السياسة وحده موافقة مستقلة على ذلك. يمكنك الامتناع عن استخدام المساعد والتواصل مع المركز مباشرة. المساعد لا يحل محل المختص أو خدمات الطوارئ؛ يرجى عدم إدخال معلومات صحية أو بيانات عن أشخاص آخرين لا يحتاجها طلبك.",
  'legal.privacy.title': 'سياسة الخصوصية',
  'legal.privacy.intro':
    "توضح هذه السياسة كيفية تعامل شركة سواء للإرشاد الأسري («الشركة» أو «نحن»)، بصفتها جهة التحكم والمشغلة لمركز سواء، مع البيانات الشخصية عند استخدام موقع sawaa.sa وتطبيق سواء وخدمات الحجز والدفع والإرشاد والتواصل المرتبطة بهما. تشمل السياسة بيانات المستفيدين وممثليهم النظاميين، وتُقرأ مع الإشعارات والموافقات الخاصة بكل خدمة.",
  'legal.privacy.collect.title':
    "البيانات التي نعالجها ومصادرها",
  'legal.privacy.collect.body':
    "بحسب الخدمة التي تستخدمها، نعالج بيانات الحساب والتواصل، مثل الاسم ورقم الجوال والبريد الإلكتروني ومعرّف الحساب وتفضيلات اللغة. وقد يتضمن ملف المستفيد تاريخ الميلاد والجنس والجنسية وبيانات الهوية وجهة الاتصال للطوارئ عند جمعها لغرض الخدمة. نعالج بيانات الحجوزات والمواعيد والباقات والفواتير وحالة الدفع والاسترداد ومراجع المعاملات، والمرفقات التي ترفعها مثل إيصالات التحويل. وتشمل البيانات الحساسة ما تقدمه أو يوثقه المختص من معلومات أسرية وصحية ونفسية وتقييمات وملاحظات إرشادية. نجمع المعلومات مباشرةً منك أو من ممثلك النظامي أو من المختص أثناء تقديم الخدمة، ونتلقى من مزودي الخدمة البيانات اللازمة لتنفيذ الدفع والتواصل والجلسات. كما تعالج أنظمتنا بيانات تقنية لازمة للتشغيل والأمان، مثل عنوان الشبكة ومعلومات الجهاز ونظام التشغيل وإصدار التطبيق وسجلات الأخطاء والأداء ورمز الإشعارات عند تفعيلها. وتتضمن خدمات التواصل محتوى الرسائل وبياناتها والمعلومات التي تقدمها للدعم.",
  'legal.privacy.purpose.title':
    "الأغراض والبيانات المطلوبة والاختيارية",
  'legal.privacy.purpose.body':
    "نستخدم البيانات لإنشاء الحساب والتحقق من هويتك، وتنظيم الخدمات والمواعيد وتقديم الإرشاد، وإدارة المدفوعات والفواتير والاسترداد، وإرسال التأكيدات والتنبيهات، والرد على الاستفسارات، وحماية الحسابات ومعالجة الأعطال، والوفاء بالالتزامات النظامية والمهنية. نوضح الحقول المطلوبة والاختيارية عند الجمع؛ عدم تقديم بيانات لازمة قد يمنع إتمام الخدمة ذات الصلة. رفض الأذونات الاختيارية لا يمنع استخدام الوظائف التي لا تحتاج إليها.",
  'legal.privacy.retention.title':
    "الاحتفاظ والإتلاف",
  'legal.privacy.retention.body':
    "نحتفظ بالبيانات وفق فئتها والغرض منها: بيانات الحساب طوال تقديم الخدمة وما يلزم بعدها لإغلاق الالتزامات؛ والسجلات الإرشادية والصحية والمالية للمدة التي تفرضها المتطلبات النظامية والمهنية المنطبقة؛ وسجلات الأمان والتشغيل والمراسلات للمدة اللازمة لمعالجة الطلبات وحماية النظام. عند انتهاء الغرض وعدم وجود مسوغ للاستبقاء، تُتلف البيانات أو تُخفى هوية أصحابها بصورة لا تتيح إعادة التعرف عليهم. يشمل التعامل مع طلبات الإتلاف النسخ والمعالجين والنسخ الاحتياطية وفق المتطلبات النظامية. يمكنك طلب توضيح مدة الاحتفاظ بفئة بيانات تخصك أو معايير احتسابها.",
  'legal.privacy.rights.title':
    "حقوقك وحذف الحساب",
  'legal.privacy.rights.body':
    "وفق نظام حماية البيانات الشخصية، يمكنك طلب العلم بكيفية المعالجة، والوصول إلى بياناتك والحصول على نسخة مقروءة، وتصحيحها أو تحديثها، وإتلافها في الحالات المنصوص عليها نظامًا، والعدول عن الموافقة. يمكنك بدء طلب حذف الحساب من إعدادات الحساب في التطبيق. يغلق الإجراء الدخول، ويلغي رموز الجلسات والإشعارات، ويزيل بيانات الاتصال والدخول وبعض حقول التعريف. لا يعني إغلاق الحساب الإتلاف الفوري لكل البيانات؛ تظل سجلات مرتبطة بملف المستفيد، ومنها بيانات تعريف وملاحظات وسجلات إرشادية وحجوزات ومعاملات مالية. تواصل معنا لطلب إتلاف البيانات المتبقية أو معرفة ما يلزم استبقاؤه وسبب ومدة استبقائه. قد نتحقق من هويتك لحماية بياناتك، ونعالج طلبات ممارسة الحقوق خلال ثلاثين يومًا، مع تمديد لا يزيد على ثلاثين يومًا إضافية في الحالات التي تجيزها اللائحة وبعد إبلاغك بالمبررات.",
  'legal.privacy.hosting.title':
    "التخزين والأمان والنقل الدولي",
  'legal.privacy.hosting.body':
    "تُحفظ البيانات في أنظمة المركز ومعالجيه، مع تدابير فنية وتنظيمية مناسبة، تشمل ضبط الصلاحيات وحماية بيانات الدخول وتأمين الاتصال. قد تستلزم بعض الخدمات معالجة بيانات خارج المملكة العربية السعودية. نحدد نطاق المعالجة ونطبق شروط وضمانات النقل المطلوبة بموجب نظام حماية البيانات الشخصية ولوائحه قبل النقل. يمكن طلب معلومات عن أماكن المعالجة والضمانات من المركز. لا توجد وسيلة اتصال أو تخزين يمكن ضمان خلوها التام من المخاطر.",
  'legal.privacy.contact.title': 'التواصل بشأن الخصوصية',
  'legal.privacy.contact.body':
    "للاستفسارات أو طلبات الخصوصية، تواصل مع شركة سواء للإرشاد الأسري على support@sawaa.sa أو 0558446605. عنوان المركز: الرياض، شارع تركي الأول، حي المحمدية. يمكن طلب توضيح البيانات التي تُعالج، والجهات المستلمة، ومدد الاحتفاظ، وأماكن المعالجة، وآلية ممارسة الحقوق.",
  'legal.privacy.complaint.title': 'الشكاوى إلى الجهة التنظيمية',
  'legal.privacy.complaint.body':
    'إذا لم تتم معالجة طلبك خلال المدة النظامية، يحق لك تقديم شكوى إلى الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا) عبر موقعها الرسمي أو عبر القنوات المعتمدة لديها، عملاً بأحكام نظام حماية البيانات الشخصية ولوائحه التنفيذية في المملكة العربية السعودية.',
  'legal.privacy.cookies.title':
    "ملفات الارتباط والقياس",
  'legal.privacy.cookies.body':
    "يستخدم الموقع ملفات الارتباط والتخزين المحلي اللازمين لتشغيل الجلسة وحفظ اللغة والمظهر والاختيارات. تحميل القياس الاختياري مثل Plausible مشروط بوجود اختيار موافقة مسجل؛ ولا تُستخدم بيانات الجلسات الإرشادية لقياس زيارات الموقع. لإزالة اختيار سابق وإيقاف تحميل القياس، يمكنك حذف بيانات هذا الموقع من إعدادات المتصفح، أو التواصل معنا لطلب المساعدة. قد يؤدي حذف بيانات الموقع أيضًا إلى تسجيل خروجك وإعادة ضبط تفضيلاتك.",
  'legal.privacy.minors.title':
    "القاصرون وبيانات الغير",
  'legal.privacy.minors.body':
    "عندما تتطلب الخدمة بيانات قاصر أو ناقص أهلية، تتم معالجة البيانات من خلال وليه أو ممثله النظامي ووفق الموافقات والمتطلبات المنطبقة. لا يجوز تقديم بيانات أشخاص آخرين دون صلاحية أو مسوغ نظامي. إذا أُبلغنا بجمع غير مشروع، نتحقق ونتخذ الإجراء المناسب، بما في ذلك الإتلاف حيث يلزم نظامًا.",
  'legal.privacy.changes.title': 'التغييرات على سياسة الخصوصية',
  'legal.privacy.changes.body':
    'قد نُحدّث هذه السياسة من وقت لآخر لتعكس التغييرات في ممارساتنا أو في الأنظمة المعمول بها. سنُعلمك بالتغييرات الجوهرية عبر الموقع أو البريد الإلكتروني عند الاقتضاء. تاريخ آخر تحديث مذكور في أعلى الصفحة.',
  'legal.terms.title': 'الشروط والأحكام',
  'legal.terms.intro':
    'تحكم هذه الشروط والأحكام استخدامك لموقع مركز سواء للاستشارات الأسرية وخدماته. باستخدامك الموقع أو حجز أي خدمة فإنك تقرّ بموافقتك على هذه الشروط. يُرجى قراءتها بعناية قبل استخدام الخدمة.',
  'legal.terms.service.title': 'وصف الخدمة',
  'legal.terms.service.body':
    'يقدّم مركز سواء خدمات استشارية نفسية وأسرية وخدمات علاجية متخصصة، حضورياً أو عن بُعد، عبر كوادر مؤهلة. الخدمات المقدّمة عبر الموقع ذات طابع استشاري ولا تُعدّ بديلاً عن خدمات الطوارئ الطبية؛ ففي الحالات الطارئة أو الخطر على الحياة يجب التواصل فوراً مع جهات الطوارئ المختصة.',
  'legal.terms.booking.title': 'حجز المواعيد والدفع والإلغاء',
  'legal.terms.booking.body':
    'يتم تأكيد الموعد بعد إتمام الدفع عبر بوابة الدفع المعتمدة، والأسعار المعروضة نهائية وتشمل ضريبة القيمة المضافة حيثما تنطبق نظاماً. يمكنك إلغاء الموعد أو إعادة جدولته وفق سياسة الإلغاء المعلنة عند الحجز، وقد يخضع الإلغاء المتأخر أو عدم الحضور لرسوم. تخضع المبالغ المستردّة — إن وُجدت — للسياسة المعمول بها ولإجراءات بوابة الدفع.',
  'legal.terms.responsibilities.title': 'مسؤوليات المستخدم',
  'legal.terms.responsibilities.body':
    'تتعهّد بتقديم بيانات صحيحة ومحدّثة، وبالحفاظ على سرية بيانات دخولك إلى حسابك، وبعدم إساءة استخدام الموقع أو الخدمات. أنت مسؤول عن أي نشاط يتم عبر حسابك. يُمنع استخدام الخدمة لأي غرض غير مشروع أو مخالف للأنظمة المعمول بها في المملكة.',
  'legal.terms.liability.title': 'حدود المسؤولية',
  'legal.terms.liability.body':
    'يبذل مركز سواء عناية مهنية معقولة في تقديم خدماته، إلا أنه لا يضمن نتائج علاجية محددة. وفي الحدود التي تجيزها الأنظمة، لا يتحمّل المركز المسؤولية عن أي أضرار غير مباشرة أو تبعية ناشئة عن استخدام الموقع أو انقطاع الخدمة أو الاعتماد على المحتوى الاستشاري العام المنشور على الموقع.',
  'legal.terms.law.title': 'القانون الحاكم وتسوية النزاعات',
  'legal.terms.law.body':
    'تخضع هذه الشروط وتُفسَّر وفقاً للأنظمة المعمول بها في المملكة العربية السعودية، وتختص الجهات القضائية المختصة في المملكة بالنظر في أي نزاع ينشأ عن استخدام الموقع أو الخدمات.',
} as const;

const en: Record<keyof typeof ar, string> = {
  'legal.lastUpdated': 'Last updated: May 2026',
  'legal.reviewNotice':
    'Notice: This text is preliminary, for illustration only, and is subject to review and final approval by a licensed legal advisor in the Kingdom of Saudi Arabia before official launch.',
  'legal.privacy.lastUpdated':
    "Last updated: 4 October 2026",
  'legal.privacy.consent.title':
    "Legal basis and consent",
  'legal.privacy.consent.body':
    "We process data based on consent, performance of an agreement to which you are a party, or a legal obligation, depending on the data and stated purpose. When consent is the basis for processing sensitive data, we request explicit, demonstrable consent before processing. Simply reading this policy is not separate consent to that processing. You can withdraw consent using the contact details below and disable permissions in your device settings. Withdrawal does not affect earlier lawful processing and may prevent continuation of a service that depends on that processing, subject to legally required retention.",
  'legal.privacy.sharing.title':
    "Recipients of data",
  'legal.privacy.sharing.body':
    "Access within the Center is limited to authorized professionals and staff according to their duties. We share the minimum necessary information with hosting and storage providers; payment providers such as Moyasar; remote session providers such as Zoom; messaging, email and notification services such as Firebase; and fault monitoring services such as Sentry or GlitchTip, according to the services actually operated. Processors are subject to confidentiality, security and use restrictions that provide protection equal to that required by this policy and applicable law. We may disclose information to competent authorities where legally required. We do not sell personal data or use health or mental health data for advertising, marketing or advertising tracking. Optional marketing communications require the applicable legal basis and consent and a means to opt out.",
  'legal.privacy.payment.title':
    "Payments",
  'legal.privacy.payment.body':
    "Payments are processed through the relevant payment provider, including Apple Pay when available. The Center retains information necessary to document transactions and manage invoices and refunds, such as the amount, payment status and reference. Provider responses may include the payment method and masked details. Attachments you upload as evidence of a bank transfer are processed for that purpose. Please avoid including unnecessary financial information.",
  'legal.privacy.permissions.title':
    "Remote sessions and device permissions",
  'legal.privacy.permissions.body':
    "Remote sessions require the session provider to process audio, video, your name and connection information necessary for the session. We request camera and microphone permissions when you use the feature, photo permissions to select attachments, and notification permission to send alerts when enabled. You can control these permissions in your device settings. Using a camera or microphone for a session does not itself constitute consent to record it or use it for another purpose.",
  'legal.privacy.ai.title':
    "Optional AI assistant",
  'legal.privacy.ai.body':
    "An optional website assistant may be offered for information and service assistance. When operated, it processes messages, conversation history and context relating to a service request using OpenRouter and the selected model provider. Sharing personal data with an external AI service requires identifying the provider, the information sent and the purpose, and obtaining explicit consent before sharing. Reading this policy alone is not separate consent to such sharing. You can choose not to use the assistant and contact the Center directly. The assistant does not replace a professional or emergency services. Please do not enter health information or information about other people that your request does not require.",
  'legal.privacy.title': 'Privacy Policy',
  'legal.privacy.intro':
    "Sawa Family Counseling Company (the “Company”, “we” or “us”), as the data controller and operator of Sawa Center, explains in this policy how it handles personal data when you use sawaa.sa, the Sawa app, and related booking, payment, counseling and communication services. This policy covers service users and their legal representatives and should be read alongside notices and consent requests specific to each service.",
  'legal.privacy.collect.title':
    "Data we process and its sources",
  'legal.privacy.collect.body':
    "Depending on the service you use, we process account and contact details, such as your name, phone number, email address, account identifier and language preferences. A service user’s record may also include date of birth, gender, nationality, identity details and emergency contact information when collected for the service. We process bookings, appointments, packages, invoices, payment and refund status, transaction references and attachments you upload, such as bank transfer receipts. Sensitive data includes family, health and mental health information, assessments and counseling notes that you provide or a professional records during service delivery. We collect information directly from you, your legal representative or a professional providing the service, and receive information needed for payments, communications and sessions from service providers. Our systems also process technical information needed for operation and security, such as IP address, device and operating system information, app version, error and performance logs, and a notification token when notifications are enabled. Communication services include message content and metadata and information you provide for support.",
  'legal.privacy.purpose.title':
    "Purposes and required or optional information",
  'legal.privacy.purpose.body':
    "We use data to create your account and verify your identity; organize services and appointments and provide counseling; manage payments, invoices and refunds; send confirmations and reminders; respond to enquiries; protect accounts and resolve faults; and meet legal and professional obligations. Required and optional fields are identified when data is collected. Not providing necessary information may prevent completion of the relevant service. Refusing optional permissions does not prevent you from using functions that do not require them.",
  'legal.privacy.retention.title':
    "Retention and destruction",
  'legal.privacy.retention.body':
    "We retain data according to its category and purpose: account data while services are provided and as needed to settle outstanding obligations; counseling, health and financial records for periods required by applicable legal and professional obligations; and security, operational and correspondence records for as long as needed to handle requests and protect systems. When the purpose ends and there is no basis for retention, data is destroyed or anonymized so that individuals cannot be reidentified. Destruction requests cover copies, processors and backups in accordance with legal requirements. You can request the retention period or the criteria used to determine it for a category of your data.",
  'legal.privacy.rights.title':
    "Your rights and account deletion",
  'legal.privacy.rights.body':
    "Under the Saudi Personal Data Protection Law, you may request information about processing, access to your data and a readable copy, correction or updating, destruction in circumstances specified by law, and withdrawal of consent. You can initiate an account deletion request from the app’s account settings. The action closes access, revokes session and notification tokens, and removes contact and login information and some identification fields. Closing the account does not immediately destroy all data. Records associated with the service user remain, including identification information, notes, counseling records, bookings and financial transactions. Contact us to request destruction of remaining data or to learn what must be retained, why and for how long. We may verify your identity to protect your data and handle rights requests within thirty days, with an extension of no more than thirty additional days in circumstances allowed by the regulations and after notifying you of the reasons.",
  'legal.privacy.hosting.title':
    "Storage, security and international transfers",
  'legal.privacy.hosting.body':
    "Data is stored in the Center’s systems and those of its processors, with appropriate technical and organizational measures, including access controls, protection of login information and secure communications. Some services may require processing outside Saudi Arabia. We identify the scope of processing and apply the transfer conditions and safeguards required by the Saudi Personal Data Protection Law and its regulations before transfer. You can request information about processing locations and safeguards from the Center. No communication or storage method can be guaranteed completely free from risk.",
  'legal.privacy.contact.title': 'Privacy Contact',
  'legal.privacy.contact.body':
    "For privacy enquiries or requests, contact Sawa Family Counseling Company at support@sawaa.sa or 0558446605. The Center’s address is Turki Al Awwal Street, Al Muhammadiyah, Riyadh. You can request information about data processed, recipients, retention periods, processing locations and how to exercise your rights.",
  'legal.privacy.complaint.title': 'Complaints to the Regulator',
  'legal.privacy.complaint.body':
    'If your request is not handled within the statutory period, you have the right to file a complaint with the Saudi Data and AI Authority (SDAIA) through its official website or the approved channels, in accordance with the provisions of the Personal Data Protection Law and its implementing regulations in the Kingdom of Saudi Arabia.',
  'legal.privacy.cookies.title':
    "Cookies and measurement",
  'legal.privacy.cookies.body':
    "The website uses cookies and local storage necessary for sessions, language, appearance and choices. Loading optional measurement such as Plausible requires a recorded consent choice. Counseling session data is not used to measure website visits. To remove a previous choice and stop measurement from loading, you can clear this site’s data in your browser settings or contact us for assistance. Clearing site data may also sign you out and reset your preferences.",
  'legal.privacy.minors.title':
    "Minors and other people’s data",
  'legal.privacy.minors.body':
    "Where a service requires data about a minor or a person lacking legal capacity, data is processed through their guardian or legal representative and in accordance with applicable consent and other requirements. You must not provide other people’s data without authority or a legal basis. If unlawful collection is reported to us, we investigate and take appropriate action, including destruction where legally required.",
  'legal.privacy.changes.title': 'Changes to This Privacy Policy',
  'legal.privacy.changes.body':
    'We may update this policy from time to time to reflect changes in our practices or in the regulations in force. We will notify you of material changes via the site or email where appropriate. The last-updated date is shown at the top of the page.',
  'legal.terms.title': 'Terms & Conditions',
  'legal.terms.intro':
    'These terms and conditions govern your use of the Sawa Family Counseling Center website and its services. By using the site or booking any service, you acknowledge your acceptance of these terms. Please read them carefully before using the service.',
  'legal.terms.service.title': 'Service Description',
  'legal.terms.service.body':
    'Sawa Center provides psychological and family counseling and specialized therapeutic services, in person or remotely, through qualified professionals. Services offered through the site are advisory in nature and are not a substitute for emergency medical services; in emergencies or life-threatening situations you must contact the relevant emergency authorities immediately.',
  'legal.terms.booking.title': 'Booking, Payment & Cancellation',
  'legal.terms.booking.body':
    'An appointment is confirmed after payment is completed through the approved payment gateway. Displayed prices are final and include Value Added Tax where applicable by law. You may cancel or reschedule an appointment in accordance with the cancellation policy disclosed at booking; late cancellation or no-show may be subject to a fee. Refunds, if any, are subject to the applicable policy and the payment gateway procedures.',
  'legal.terms.responsibilities.title': 'User Responsibilities',
  'legal.terms.responsibilities.body':
    'You undertake to provide accurate and up-to-date information, to keep your account login credentials confidential, and not to misuse the site or services. You are responsible for any activity carried out through your account. Using the service for any unlawful purpose or in violation of the regulations in force in the Kingdom is prohibited.',
  'legal.terms.liability.title': 'Limitation of Liability',
  'legal.terms.liability.body':
    'Sawa Center exercises reasonable professional care in providing its services but does not guarantee specific therapeutic outcomes. To the extent permitted by law, the Center is not liable for any indirect or consequential damages arising from use of the site, service interruption, or reliance on general advisory content published on the site.',
  'legal.terms.law.title': 'Governing Law & Dispute Resolution',
  'legal.terms.law.body':
    'These terms are governed by and construed in accordance with the laws in force in the Kingdom of Saudi Arabia, and the competent judicial authorities in the Kingdom shall have jurisdiction over any dispute arising from use of the site or services.',
};

export const legalDictionary: LocalizedDictionary<typeof ar> = { ar, en };
