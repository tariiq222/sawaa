import { openApi, type OpenApiResponse } from "@/lib/api/openapi"

function typecheckOpenApiContract() {
  const list = openApi.get("/api/v1/dashboard/people/clients", {
    query: { page: 1, limit: 20, search: "Sara", isActive: true },
  })
  const expectedList: Promise<{
    items: Array<{ id: string; ref: number; emailVerified: string | null }>
    meta: { total: number; page: number }
  }> = list
  void expectedList

  const detail = openApi.get("/api/v1/dashboard/people/clients/{id}", {
    path: { id: "client-1" },
  })
  const expectedDetail: Promise<{ id: string; ref: number }> = detail
  void expectedDetail

  const deleted = openApi.delete("/api/v1/dashboard/people/clients/{id}", {
    path: { id: "client-1" },
  })
  const expectedDelete: Promise<void> = deleted
  void expectedDelete

  const created = openApi.post("/api/v1/dashboard/people/clients", {
    body: {
      firstName: "Sara",
      lastName: "Al-Harbi",
      phone: "+966501234567",
      gender: "female",
      bloodType: "O_NEG",
    },
  })
  const expectedCreate: Promise<{ id: string; isExisting: boolean }> = created
  void expectedCreate

  const updated = openApi.patch(
    "/api/v1/dashboard/people/clients/{id}",
    {
      path: { id: "client-1" },
      body: { firstName: "Sara", allergies: null },
    },
  )
  const expectedUpdate: Promise<{ id: string; ref: number }> = updated
  void expectedUpdate

  const result = openApi.patch(
    "/api/v1/dashboard/people/clients/{id}/active",
    {
      path: { id: "client-1" },
      body: { isActive: false, reason: "Requested by client" },
    },
  )

  const expected: Promise<{ id: string; isActive: boolean }> = result
  void expected

  openApi.get("/api/v1/dashboard/people/clients", {
    // @ts-expect-error The list operation has no arbitrary query keys.
    query: { unsupported: true },
  })

  openApi.post("/api/v1/dashboard/people/clients", {
    // @ts-expect-error The generated create contract requires a phone number.
    body: { firstName: "Sara", lastName: "Al-Harbi" },
  })

  openApi.patch("/api/v1/dashboard/people/clients/{id}/active", {
    path: { id: "client-1" },
    // @ts-expect-error OpenAPI marks isActive as required.
    body: { reason: "Missing active state" },
  })

  // @ts-expect-error This route has no POST operation in OpenAPI.
  openApi.post("/api/v1/dashboard/people/clients/{id}/active", {
    path: { id: "client-1" },
    body: { isActive: true },
  })
}

void typecheckOpenApiContract

function typecheckCategoriesAndNotifications() {
  type NotificationMetadata = OpenApiResponse<
    "/api/v1/dashboard/comms/notifications", "get"
  >["items"][number]["metadata"]
  const metadataValues: NotificationMetadata[] = [null, "text", 42, false, [], { nested: [null, true] }]
  void metadataValues
  const categories = openApi.get("/api/v1/dashboard/organization/categories", {
    query: { page: 2, limit: 10, isActive: false, search: "عيادة" },
  })
  const categoryList: Promise<{
    items: Array<{
      id: string
      departmentId: string | null
      nameEn: string | null
      bookingMode: "DIRECT" | "SERVICES"
      department: { id: string; nameEn: string | null } | null
      _count: { services: number }
    }>
    meta: { total: number; page: number; hasNextPage: boolean }
  }> = categories
  void categoryList

  const deletedCategory: Promise<{ id: string; imageUrl: string | null }> =
    openApi.delete("/api/v1/dashboard/organization/categories/{categoryId}", {
      path: { categoryId: "category-id" },
    })
  void deletedCategory

  openApi.patch("/api/v1/dashboard/organization/categories/{categoryId}", {
    path: { categoryId: "category-id" },
    body: { departmentId: null },
  })
  openApi.get("/api/v1/dashboard/organization/categories", {
    // @ts-expect-error Pagination is numeric on the generated contract.
    query: { page: "2" },
  })
  openApi.post("/api/v1/dashboard/organization/categories", {
    // @ts-expect-error Creating a category requires its Arabic name.
    body: { nameEn: "Clinic" },
  })

  const notifications: Promise<{
    items: Array<{
      id: string
      readAt: string | null
      recipientType: "CLIENT" | "EMPLOYEE"
      metadata: unknown
    }>
    meta: { total: number; page: number; hasNextPage: boolean }
  }> = openApi.get("/api/v1/dashboard/comms/notifications", {
    query: { page: 1, limit: 20, unreadOnly: false },
  })
  void notifications

  const unread: Promise<{ count: number }> = openApi.get(
    "/api/v1/dashboard/comms/notifications/unread-count",
  )
  const marked: Promise<void> = openApi.patch(
    "/api/v1/dashboard/comms/notifications/mark-read",
    { body: {} },
  )
  void unread
  void marked

  openApi.get("/api/v1/dashboard/comms/notifications", {
    // @ts-expect-error The generated filter is a boolean.
    query: { unreadOnly: "false" },
  })
  openApi.patch("/api/v1/dashboard/comms/notifications/mark-read", {
    // @ts-expect-error The contract accepts notificationId, not an arbitrary id key.
    body: { id: "notification-id" },
  })
}

void typecheckCategoriesAndNotifications
