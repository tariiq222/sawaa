/**
 * Query Keys — Sawaa Dashboard
 *
 * Centralized query key factory for TanStack Query.
 * Ensures consistent keys for cache invalidation.
 */

export const queryKeys = {
  /* ─── Bookings ─── */
  bookings: {
    all: ["bookings"] as const,
    list: (filters?: object) => ["bookings", "list", filters] as const,
    detail: (id: string) => ["bookings", "detail", id] as const,
    statusLog: (id: string) => ["bookings", "status-log", id] as const,
  },

  /* ─── Clients ─── */
  clients: {
    all: ["clients"] as const,
    list: (filters?: object) => ["clients", "list", filters] as const,
    listStats: () => ["clients", "list-stats"] as const,
    detail: (id: string) => ["clients", "detail", id] as const,
    bookings: (id: string) => ["clients", "detail", id, "bookings"] as const,
  },

  /* ─── Employees ─── */
  employees: {
    all: ["employees"] as const,
    list: (filters?: object) => ["employees", "list", filters] as const,
    detail: (id: string) => ["employees", "detail", id] as const,
    availability: (id: string) => ["employees", "availability", id] as const,
    schedule: (employeeId: string) =>
      [...queryKeys.employees.all, "schedule", employeeId] as const,
    slots: (id: string, date: string) =>
      ["employees", "slots", id, date] as const,
    breaks: (id: string) => ["employees", "breaks", id] as const,
    vacations: (id: string) => ["employees", "vacations", id] as const,
    services: (id: string) => ["employees", "services", id] as const,
    serviceTypes: (employeeId: string, serviceId: string) =>
      [
        ...(["employees"] as const),
        employeeId,
        "service-types",
        serviceId,
      ] as const,
    ratings: (id: string) => ["employees", "ratings", id] as const,
    account: (id: string) => ["employees", "account", id] as const,
    practitionerDurations: (employeeId: string, serviceId: string) =>
      ['employees', employeeId, 'practitioner-durations', serviceId] as const,
  },

  /* ─── Services ─── */
  services: {
    all: ["services"] as const,
    list: (filters?: object) => ["services", "list", filters] as const,
    listStats: () => ["services", "list-stats"] as const,
    detail: (id: string) => ["services", "detail", id] as const,
    categories: (filters?: object) =>
      ["services", "categories", filters ?? {}] as const,
    bookingTypes: (serviceId: string) =>
      ["services", serviceId, "booking-types"] as const,
    durationOptions: (serviceId: string) =>
      ["services", "duration-options", serviceId] as const,
    intakeForms: (serviceId: string) =>
      ["services", "intake-forms", serviceId] as const,
    intakeResponses: (bookingId: string) =>
      ["services", "intake-responses", bookingId] as const,
    employees: (serviceId: string) =>
      ["services", "employees", serviceId] as const,
  },

  /* ─── Payments ─── */
  payments: {
    all: ["payments"] as const,
    list: (filters?: object) => ["payments", "list", filters] as const,
    detail: (id: string) => ["payments", "detail", id] as const,
    byBooking: (bookingId: string) =>
      ["payments", "booking", bookingId] as const,
  },

  /* ─── Invoices ─── */
  invoices: {
    all: ["invoices"] as const,
    list: (filters?: object) => ["invoices", "list", filters] as const,
    detail: (id: string) => ["invoices", "detail", id] as const,
    html: (id: string) => ["invoices", "html", id] as const,
  },

  /* ─── Users ─── */
  users: {
    all: ["users"] as const,
    list: (filters?: object) => ["users", "list", filters] as const,
    detail: (id: string) => ["users", "detail", id] as const,
  },

  /* ─── Roles ─── */
  roles: {
    all: ["roles"] as const,
    list: () => ["roles", "list"] as const,
  },

  /* ─── Permissions ─── */
  permissions: {
    all: ["permissions"] as const,
    list: () => ["permissions", "list"] as const,
  },

  /* ─── Notifications ─── */
  notifications: {
    all: ["notifications"] as const,
    list: (filters?: object) => ["notifications", "list", filters] as const,
    unreadCount: () => ["notifications", "unread-count"] as const,
  },

  /* ─── Reports ─── */
  reports: {
    overview: (filters?: object) => ["reports", "overview", filters] as const,
    revenue: (filters?: object) => ["reports", "revenue", filters] as const,
    bookings: (filters?: object) => ["reports", "bookings", filters] as const,
    clients: (filters?: object) => ["reports", "clients", filters] as const,
    practitioners: (filters?: object) =>
      ["reports", "practitioners", filters] as const,
    services: (filters?: object) => ["reports", "services", filters] as const,
    ratings: (filters?: object) => ["reports", "ratings", filters] as const,
    employee: (id: string, filters?: object) =>
      ["reports", "employee", id, filters] as const,
  },

  /* ─── Chatbot ─── */
  chatbot: {
    sessions: {
      all: ["chatbot", "sessions"] as const,
      list: (filters?: object) =>
        ["chatbot", "sessions", "list", filters] as const,
      detail: (id: string) => ["chatbot", "sessions", "detail", id] as const,
    },
    knowledgeBase: {
      all: ["chatbot", "knowledge-base"] as const,
      list: (filters?: object) =>
        ["chatbot", "knowledge-base", "list", filters] as const,
    },
    config: {
      all: ["chatbot", "config"] as const,
      list: () => ["chatbot", "config", "singleton"] as const,
    },
    analytics: {
      all: (filters?: object) => ["chatbot", "analytics", filters] as const,
      questions: (limit?: number) =>
        ["chatbot", "analytics", "questions", limit] as const,
    },
  },

  /* ─── Organization ─── */
  organization: {
    all: ["organization"] as const,
    profile: () => ["organization", "profile"] as const,
    hours: (branchId?: string) => ["organization-hours", branchId] as const,
    holidays: (branchId?: string, year?: number) => ["organization-holidays", branchId, year] as const,
  },

  /* ─── Ratings (org-level) ─── */
  ratings: {
    all: ["ratings"] as const,
    list: (filters?: object) => ["ratings", "list", filters] as const,
  },

  /* ─── Coupons ─── */
  coupons: {
    all: ["coupons"] as const,
    list: (filters?: object) => ["coupons", "list", filters] as const,
    detail: (id: string) => ["coupons", "detail", id] as const,
  },

  discountReasons: {
    all: ["discount-reasons"] as const,
    list: (includeInactive?: boolean) => ["discount-reasons", "list", includeInactive] as const,
  },

  /* ─── Branches ─── */
  branches: {
    all: ["branches"] as const,
    list: (filters?: object) => ["branches", "list", filters] as const,
    detail: (id: string) => ["branches", "detail", id] as const,
    employees: (id: string) => ["branches", "employees", id] as const,
  },

  /* ─── Departments ─── */
  departments: {
    all: ["departments"] as const,
    list: (filters?: object) => ["departments", "list", filters] as const,
    detail: (id: string) => ["departments", "detail", id] as const,
  },

  /* ─── Email Templates ─── */
  emailTemplates: {
    all: ["email-templates"] as const,
    list: () => ["email-templates", "list"] as const,
    detail: (slug: string) => ["email-templates", "detail", slug] as const,
  },

  /* ─── Intake Forms ─── */
  intakeForms: {
    all: ["intake-forms"] as const,
    list: (filters?: object) => ["intake-forms", "list", filters] as const,
    detail: (id: string) => ["intake-forms", "detail", id] as const,
    responses: (bookingId: string) =>
      ["intake-forms", "responses", bookingId] as const,
  },

  /* ─── Booking Settings ─── */
  bookingSettings: {
    all: ["booking-settings"] as const,
    detail: () => ["booking-settings", "detail"] as const,
  },

  /* ─── Organization Settings ─── */
  organizationSettings: {
    all: ["organization-settings"] as const,
    config: () => ["organization-settings", "config"] as const,
    public: () => ["organization-settings", "public"] as const,
    bookingFlowOrder: () =>
      ["organization-settings", "booking-flow-order"] as const,
    payment: () => ["organization-settings", "payment"] as const,
  },

  /* ─── Organization Public Settings ─── */
  organizationPublic: {
    settings: () => ["organization-settings", "public"] as const,
  },

  /* ─── Contact Messages ─── */
  contactMessages: {
    all: ["contact-messages"] as const,
    list: (filters?: object) => ["contact-messages", "list", filters] as const,
  },

  /* ─── Dashboard ─── */
  dashboard: {
    all: ["dashboard"] as const,
    topPerformers: () => ["dashboard", "top-performers"] as const,
  },

  /* ─── Bundles ─── */
  bundles: {
    all: ["bundles"] as const,
    list: (filters?: object) => ["bundles", "list", filters ?? {}] as const,
    detail: (id: string) => ["bundles", "detail", id] as const,
  },

  /* ─── Group Sessions ─── */
  groupSessions: {
    all: ["group-sessions"] as const,
    list: (filters?: object) => ["group-sessions", "list", filters] as const,
    detail: (id: string) => ["group-sessions", "detail", id] as const,
  },

  /* ─── Group Programs ─── */
  groupPrograms: {
    all: ["group-programs"] as const,
    list: (filters?: object) => ["group-programs", "list", filters] as const,
  },
} as const
