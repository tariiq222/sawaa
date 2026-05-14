import { FeatureKey } from "./feature-keys";

export type FeatureGroup =
  | "Booking & Scheduling"
  | "Client Engagement"
  | "Finance & Compliance"
  | "Operations"
  | "Platform";

export type FeatureCatalogEntry = {
  key: FeatureKey;
  kind: "boolean" | "quantitative";
  tier: "PRO" | "ENTERPRISE";
  group: FeatureGroup;
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
};

export const FEATURE_CATALOG: Record<FeatureKey, FeatureCatalogEntry> = {
  [FeatureKey.RECURRING_BOOKINGS]: {
    key: FeatureKey.RECURRING_BOOKINGS,
    kind: "boolean", tier: "PRO", group: "Booking & Scheduling",
    nameAr: "الحجوزات المتكررة", nameEn: "Recurring Bookings",
    descAr: "إنشاء سلاسل مواعيد أسبوعية أو شهرية بنقرة واحدة",
    descEn: "Create weekly or monthly appointment series in one click",
  },
  [FeatureKey.WAITLIST]: {
    key: FeatureKey.WAITLIST,
    kind: "boolean", tier: "PRO", group: "Booking & Scheduling",
    nameAr: "قائمة الانتظار", nameEn: "Waitlist",
    descAr: "إدارة قائمة عملاء بانتظار شواغر في الجدول",
    descEn: "Manage a queue of clients waiting for openings",
  },
  [FeatureKey.GROUP_SESSIONS]: {
    key: FeatureKey.GROUP_SESSIONS,
    kind: "boolean", tier: "PRO", group: "Booking & Scheduling",
    nameAr: "الجلسات الجماعية", nameEn: "Group Sessions",
    descAr: "حجز جلسات بسعة متعددة وإدارة المشاركين",
    descEn: "Book multi-capacity sessions and manage attendees",
  },
  [FeatureKey.AI_CHATBOT]: {
    key: FeatureKey.AI_CHATBOT,
    kind: "boolean", tier: "PRO", group: "Client Engagement",
    nameAr: "روبوت المحادثة الذكي", nameEn: "AI Chatbot",
    descAr: "مساعد آلي يجاوب العملاء عبر قاعدة المعرفة",
    descEn: "Knowledge-base assistant that answers clients automatically",
  },
  [FeatureKey.EMAIL_TEMPLATES]: {
    key: FeatureKey.EMAIL_TEMPLATES,
    kind: "boolean", tier: "PRO", group: "Client Engagement",
    nameAr: "قوالب البريد الإلكتروني", nameEn: "Email Templates",
    descAr: "تخصيص قوالب رسائل العملاء بهوية العيادة",
    descEn: "Customize client email templates with clinic branding",
  },
  [FeatureKey.COUPONS]: {
    key: FeatureKey.COUPONS,
    kind: "boolean", tier: "PRO", group: "Finance & Compliance",
    nameAr: "كوبونات الخصم", nameEn: "Coupons",
    descAr: "إنشاء أكواد خصم بنسبة أو مبلغ ثابت",
    descEn: "Issue percentage or fixed-amount discount codes",
  },
  [FeatureKey.ADVANCED_REPORTS]: {
    key: FeatureKey.ADVANCED_REPORTS,
    kind: "boolean", tier: "ENTERPRISE", group: "Operations",
    nameAr: "التقارير المتقدمة", nameEn: "Advanced Reports",
    descAr: "تقارير تشغيلية ومالية تفصيلية قابلة للتصدير",
    descEn: "Detailed operational and financial reports, exportable",
  },
  [FeatureKey.INTAKE_FORMS]: {
    key: FeatureKey.INTAKE_FORMS,
    kind: "boolean", tier: "ENTERPRISE", group: "Client Engagement",
    nameAr: "نماذج الاستقبال", nameEn: "Intake Forms",
    descAr: "نماذج استقبال مخصصة قبل الموعد",
    descEn: "Custom pre-appointment intake forms",
  },
  [FeatureKey.CUSTOM_ROLES]: {
    key: FeatureKey.CUSTOM_ROLES,
    kind: "boolean", tier: "ENTERPRISE", group: "Operations",
    nameAr: "الأدوار المخصصة", nameEn: "Custom Roles",
    descAr: "تعريف أدوار وصلاحيات حسب احتياج المنشأة",
    descEn: "Define roles and permissions tailored to your org",
  },
  [FeatureKey.ACTIVITY_LOG]: {
    key: FeatureKey.ACTIVITY_LOG,
    kind: "boolean", tier: "ENTERPRISE", group: "Operations",
    nameAr: "سجل النشاط", nameEn: "Activity Log",
    descAr: "سجل تدقيق لكل إجراءات المستخدمين",
    descEn: "Audit trail of every user action",
  },
  [FeatureKey.BRANCHES]: {
    key: FeatureKey.BRANCHES,
    kind: "quantitative", tier: "PRO", group: "Operations",
    nameAr: "الفروع", nameEn: "Branches",
    descAr: "عدد الفروع المسموح بإنشائها",
    descEn: "Number of branches you can create",
  },
  [FeatureKey.EMPLOYEES]: {
    key: FeatureKey.EMPLOYEES,
    kind: "quantitative", tier: "PRO", group: "Operations",
    nameAr: "الموظفون", nameEn: "Employees",
    descAr: "الحد الأقصى لعدد الموظفين النشطين",
    descEn: "Maximum number of active employees",
  },
  [FeatureKey.SERVICES]: {
    key: FeatureKey.SERVICES,
    kind: "quantitative", tier: "PRO", group: "Operations",
    nameAr: "الخدمات", nameEn: "Services",
    descAr: "عدد الخدمات القابلة للتفعيل في الكتالوج",
    descEn: "Number of services activatable in the catalog",
  },
  [FeatureKey.MONTHLY_BOOKINGS]: {
    key: FeatureKey.MONTHLY_BOOKINGS,
    kind: "quantitative", tier: "PRO", group: "Booking & Scheduling",
    nameAr: "الحجوزات الشهرية", nameEn: "Monthly Bookings",
    descAr: "عدد الحجوزات المسموح بها كل شهر",
    descEn: "Bookings allowed per calendar month",
  },
  // ── Phase 3: 15 new keys ──────────────────────────────────────────

  [FeatureKey.ZOOM_INTEGRATION]: {
    key: FeatureKey.ZOOM_INTEGRATION,
    kind: "boolean", tier: "PRO", group: "Booking & Scheduling",
    nameAr: "تكامل زووم", nameEn: "Zoom Integration",
    descAr: "إنشاء روابط زووم تلقائيًا للحجوزات الافتراضية",
    descEn: "Auto-generate Zoom links for virtual appointments",
  },
  [FeatureKey.ZOHO_INVOICE_INTEGRATION]: {
    key: FeatureKey.ZOHO_INVOICE_INTEGRATION,
    kind: "boolean", tier: "PRO", group: "Finance & Compliance",
    nameAr: "تكامل فواتير زوهو", nameEn: "Zoho Invoice Integration",
    descAr: "إصدار الفواتير ومرآة المدفوعات والمرتجعات في زوهو Invoice بعد إتمام الدفع",
    descEn: "Issue invoices and mirror payments/refunds in Zoho Invoice after payment captures",
  },
  [FeatureKey.WALK_IN_BOOKINGS]: {
    key: FeatureKey.WALK_IN_BOOKINGS,
    kind: "boolean", tier: "PRO", group: "Booking & Scheduling",
    nameAr: "الحجوزات الفورية", nameEn: "Walk-in Bookings",
    descAr: "تسجيل العملاء غير المحجوزين عند وصولهم",
    descEn: "Register unscheduled clients on arrival",
  },
  [FeatureKey.BANK_TRANSFER_PAYMENTS]: {
    key: FeatureKey.BANK_TRANSFER_PAYMENTS,
    kind: "boolean", tier: "PRO", group: "Finance & Compliance",
    nameAr: "الدفع بالتحويل البنكي", nameEn: "Bank Transfer Payments",
    descAr: "قبول مدفوعات عبر إيصالات تحويل بنكي مرفقة",
    descEn: "Accept payments via uploaded bank-transfer receipts",
  },
  [FeatureKey.MULTI_BRANCH]: {
    key: FeatureKey.MULTI_BRANCH,
    kind: "boolean", tier: "PRO", group: "Operations",
    nameAr: "تعدد الفروع", nameEn: "Multi-Branch",
    descAr: "تشغيل أكثر من فرع تحت نفس المنشأة",
    descEn: "Operate more than one branch under the same org",
  },
  [FeatureKey.DEPARTMENTS]: {
    key: FeatureKey.DEPARTMENTS,
    kind: "boolean", tier: "PRO", group: "Operations",
    nameAr: "الأقسام", nameEn: "Departments",
    descAr: "تنظيم الموظفين والخدمات داخل أقسام إدارية",
    descEn: "Organize employees and services into departments",
  },
  [FeatureKey.CLIENT_RATINGS]: {
    key: FeatureKey.CLIENT_RATINGS,
    kind: "boolean", tier: "PRO", group: "Client Engagement",
    nameAr: "تقييمات العملاء", nameEn: "Client Ratings",
    descAr: "جمع تقييمات العملاء بعد كل موعد",
    descEn: "Collect client feedback after each appointment",
  },
  [FeatureKey.DATA_EXPORT]: {
    key: FeatureKey.DATA_EXPORT,
    kind: "boolean", tier: "PRO", group: "Operations",
    nameAr: "تصدير البيانات", nameEn: "Data Export",
    descAr: "تصدير التقارير والقوائم بصيغ CSV / Excel",
    descEn: "Export reports and lists as CSV / Excel",
  },
  [FeatureKey.SMS_PROVIDER_PER_TENANT]: {
    key: FeatureKey.SMS_PROVIDER_PER_TENANT,
    kind: "boolean", tier: "ENTERPRISE", group: "Operations",
    nameAr: "مزود رسائل SMS خاص", nameEn: "Dedicated SMS Provider",
    descAr: "ربط مزود رسائل خاص بالمنشأة (Unifonic / Taqnyat)",
    descEn: "Connect your own SMS provider (Unifonic / Taqnyat)",
  },
  [FeatureKey.WHITE_LABEL_MOBILE]: {
    key: FeatureKey.WHITE_LABEL_MOBILE,
    kind: "boolean", tier: "ENTERPRISE", group: "Platform",
    nameAr: "تطبيق جوال بهوية المنشأة", nameEn: "White-label Mobile App",
    descAr: "نشر تطبيق جوال مستقل باسم وهوية المنشأة",
    descEn: "Publish a standalone mobile app under your brand",
  },
  [FeatureKey.CUSTOM_DOMAIN]: {
    key: FeatureKey.CUSTOM_DOMAIN,
    kind: "boolean", tier: "ENTERPRISE", group: "Platform",
    nameAr: "نطاق مخصص", nameEn: "Custom Domain",
    descAr: "ربط نطاق المنشأة الخاص بلوحة التحكم",
    descEn: "Map your own domain to the dashboard",
  },
  [FeatureKey.API_ACCESS]: {
    key: FeatureKey.API_ACCESS,
    kind: "boolean", tier: "ENTERPRISE", group: "Platform",
    nameAr: "الوصول إلى الـAPI", nameEn: "API Access",
    descAr: "إصدار مفاتيح API للتكامل مع أنظمتك الخارجية",
    descEn: "Issue API keys to integrate with external systems",
  },
  [FeatureKey.WEBHOOKS]: {
    key: FeatureKey.WEBHOOKS,
    kind: "boolean", tier: "ENTERPRISE", group: "Platform",
    nameAr: "إشعارات Webhooks", nameEn: "Webhooks",
    descAr: "إرسال أحداث المنصة إلى مسارات HTTP خارجية",
    descEn: "Push platform events to external HTTP endpoints",
  },
  [FeatureKey.PRIORITY_SUPPORT]: {
    key: FeatureKey.PRIORITY_SUPPORT,
    kind: "boolean", tier: "ENTERPRISE", group: "Platform",
    nameAr: "دعم فني ذو أولوية", nameEn: "Priority Support",
    descAr: "قناة دعم فني سريعة الاستجابة على مدار الساعة",
    descEn: "Fast-response support channel, 24/7",
  },
  [FeatureKey.AUDIT_EXPORT]: {
    key: FeatureKey.AUDIT_EXPORT,
    kind: "boolean", tier: "ENTERPRISE", group: "Operations",
    nameAr: "تصدير سجل التدقيق", nameEn: "Audit Log Export",
    descAr: "تصدير سجل النشاط لأرشفته خارج المنصة",
    descEn: "Export the activity log for off-platform archival",
  },
  [FeatureKey.MULTI_CURRENCY]: {
    key: FeatureKey.MULTI_CURRENCY,
    kind: "boolean", tier: "ENTERPRISE", group: "Finance & Compliance",
    nameAr: "تعدد العملات", nameEn: "Multi-Currency",
    descAr: "إصدار فواتير ومدفوعات بأكثر من عملة",
    descEn: "Issue invoices and payments in multiple currencies",
  },
  [FeatureKey.EMAIL_FALLBACK_MONTHLY]: {
    key: FeatureKey.EMAIL_FALLBACK_MONTHLY,
    kind: 'quantitative', tier: 'PRO', group: 'Operations',
    nameAr: 'حصة البريد الاحتياطي الشهرية', nameEn: 'Monthly Fallback Email Quota',
    descAr: 'عدد الرسائل الإلكترونية التي ترسلها المنصة نيابةً عن المستأجر شهرياً',
    descEn: 'Platform emails sent on tenant behalf per month when no provider configured',
  },
  [FeatureKey.SMS_FALLBACK_MONTHLY]: {
    key: FeatureKey.SMS_FALLBACK_MONTHLY,
    kind: 'quantitative', tier: 'PRO', group: 'Operations',
    nameAr: 'حصة الرسائل الاحتياطية الشهرية', nameEn: 'Monthly Fallback SMS Quota',
    descAr: 'عدد رسائل SMS التي ترسلها المنصة نيابةً عن المستأجر شهرياً',
    descEn: 'Platform SMS sent on tenant behalf per month when no provider configured',
  },
};
