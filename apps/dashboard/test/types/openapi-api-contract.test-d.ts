import { openApi } from "@/lib/api/openapi"

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
