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
  PaintBrush01Icon,
  StarIcon,
  Activity01Icon,
  Layers01Icon,
  Location01Icon,
  Briefcase01Icon,
  InboxIcon,
  Package01Icon,
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

export const overviewNav: NavItem[] = [
  { titleKey: "nav.dashboard", href: "/", icon: Home01Icon },
]

export const operationsNav: NavItem[] = [
  { titleKey: "nav.bookings", href: "/bookings", icon: Calendar03Icon, permission: "booking:read" },
  { titleKey: "nav.clients", href: "/clients", icon: UserMultiple02Icon, permission: "client:read" },
  { titleKey: "nav.ratings", href: "/ratings", icon: StarIcon, permission: "employee:read" },
  { titleKey: "nav.contactMessages", href: "/contact-messages", icon: InboxIcon, permission: "setting:read" },
]

export const peopleNav: NavItem[] = [
  { titleKey: "nav.employees", href: "/employees", icon: Stethoscope02Icon, permission: "employee:read" },
  { titleKey: "nav.users", href: "/users", icon: ShieldKeyIcon, permission: "user:read" },
]

export const financeNav: NavItem[] = [
  { titleKey: "nav.payments", href: "/payments", icon: MoneyBag02Icon, permission: "payment:read" },
  // TAR-70: stubbed — restore when useInvoices hook is implemented
  // { titleKey: "nav.invoices", href: "/invoices", icon: Invoice02Icon },
  { titleKey: "nav.coupons", href: "/coupons", icon: Coupon01Icon, permission: "coupon:read" },
  { titleKey: "nav.reports", href: "/reports", icon: AnalyticsUpIcon, permission: "report:read" },
]

export const catalogNav: NavItem[] = [
  { titleKey: "nav.services", href: "/services", icon: Briefcase01Icon, permission: "service:read" },
  { titleKey: "nav.bundles", href: "/bundles", icon: Package01Icon, permission: "service:read" },
  { titleKey: "nav.categories", href: "/categories", icon: Layers01Icon, permission: "category:read" },
  { titleKey: "nav.departments", href: "/departments", icon: Building06Icon, permission: "department:read" },
  { titleKey: "nav.branches", href: "/branches", icon: Location01Icon, permission: "branch:read" },
  { titleKey: "nav.intakeForms", href: "/intake-forms", icon: DocumentValidationIcon, permission: "service:read" },
]

export const systemNav: NavItem[] = [
  { titleKey: "nav.chatbot", href: "/chatbot", icon: AiChat02Icon, permission: "setting:read" },
  { titleKey: "nav.notifications", href: "/notifications", icon: Notification03Icon, permission: "setting:read" },
  { titleKey: "nav.branding", href: "/branding", icon: PaintBrush01Icon, permission: "branding:edit" },
  { titleKey: "nav.content", href: "/content", icon: DocumentValidationIcon, permission: "content:read" },
  { titleKey: "nav.activityLog", href: "/activity-log", icon: Activity01Icon, permission: "setting:read" },
  { titleKey: "nav.settings", href: "/settings", icon: Settings02Icon, permission: "setting:read" },
]

export const navGroups: NavGroup[] = [
  { labelKey: "nav.overview", items: overviewNav },
  { labelKey: "nav.operations", items: operationsNav },
  { labelKey: "nav.people", items: peopleNav },
  { labelKey: "nav.finance", items: financeNav },
  { labelKey: "nav.catalog", items: catalogNav },
  { labelKey: "nav.system", items: systemNav },
]
