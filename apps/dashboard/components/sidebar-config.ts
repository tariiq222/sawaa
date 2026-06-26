import {
  Home01Icon,
  Calendar03Icon,
  UserMultiple02Icon,
  Stethoscope02Icon,
  Settings02Icon,
  MoneyBag02Icon,
  ShieldKeyIcon,
  AnalyticsUpIcon,
  AiChat02Icon,
  Notification03Icon,
  Coupon01Icon,
  Building06Icon,
  DocumentValidationIcon,
  StarIcon,
  Activity01Icon,
  Layers01Icon,
  Briefcase01Icon,
  InboxIcon,
  Package01Icon,
  DocumentAttachmentIcon,
  MentoringIcon,
} from "@hugeicons/core-free-icons"
export interface NavItem {
  titleKey: string
  href: string
  icon: typeof Home01Icon
  badge?: number
  permission?: string // "module:action" — item hidden if user lacks this permission
}

export interface NavGroup {
  labelKey: string
  items: NavItem[]
}

export const operationsNav: NavItem[] = [
  { titleKey: "nav.dashboard", href: "/", icon: Home01Icon },
  { titleKey: "nav.bookings", href: "/bookings", icon: Calendar03Icon, permission: "booking:read" },
  { titleKey: "nav.packages", href: "/packages", icon: Package01Icon, permission: "service:read" },
  { titleKey: "nav.programs", href: "/programs", icon: MentoringIcon, permission: "service:read" },
  { titleKey: "nav.clients", href: "/clients", icon: UserMultiple02Icon, permission: "client:read" },
  { titleKey: "nav.payments", href: "/payments", icon: MoneyBag02Icon, permission: "payment:read" },
  { titleKey: "nav.invoices", href: "/invoices", icon: DocumentAttachmentIcon, permission: "payment:read" },
]

export const practiceNav: NavItem[] = [
  { titleKey: "nav.intakeForms", href: "/intake-forms", icon: DocumentValidationIcon, permission: "service:read" },
  { titleKey: "nav.ratings", href: "/ratings", icon: StarIcon, permission: "employee:read" },
]

export const catalogNav: NavItem[] = [
  { titleKey: "nav.services", href: "/services", icon: Briefcase01Icon, permission: "service:read" },
  { titleKey: "nav.categories", href: "/categories", icon: Layers01Icon, permission: "category:read" },
  { titleKey: "nav.departments", href: "/departments", icon: Building06Icon, permission: "department:read" },
  { titleKey: "nav.employees", href: "/employees", icon: Stethoscope02Icon, permission: "employee:read" },
] 

export const managementNav: NavItem[] = [
  { titleKey: "nav.reports", href: "/reports", icon: AnalyticsUpIcon, permission: "report:read" },
  { titleKey: "nav.coupons", href: "/coupons", icon: Coupon01Icon, permission: "coupon:read" },
  { titleKey: "nav.users", href: "/users", icon: ShieldKeyIcon, permission: "user:read" },
  { titleKey: "nav.activityLog", href: "/activity-log", icon: Activity01Icon, permission: "setting:read" },
]

export const communicationNav: NavItem[] = [
  { titleKey: "nav.notifications", href: "/notifications", icon: Notification03Icon, permission: "setting:read" },
  { titleKey: "nav.contactMessages", href: "/contact-messages", icon: InboxIcon, permission: "setting:read" },
  { titleKey: "nav.chatbot", href: "/chatbot", icon: AiChat02Icon, permission: "setting:read" },
]

export const systemNav: NavItem[] = [
  { titleKey: "nav.settings", href: "/settings", icon: Settings02Icon, permission: "setting:read" },
]

export const navGroups: NavGroup[] = [
  { labelKey: "nav.operations", items: operationsNav },
  { labelKey: "nav.practice", items: practiceNav },
  { labelKey: "nav.catalog", items: catalogNav },
  { labelKey: "nav.management", items: managementNav },
  { labelKey: "nav.communication", items: communicationNav },
  { labelKey: "nav.system", items: systemNav },
]
