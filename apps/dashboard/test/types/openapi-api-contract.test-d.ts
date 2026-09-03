import { openApi } from "@/lib/api/openapi"

function typecheckOpenApiContract() {
  const result = openApi.patch(
    "/api/v1/dashboard/people/clients/{id}/active",
    {
      path: { id: "client-1" },
      body: { isActive: false, reason: "Requested by client" },
    },
  )

  const expected: Promise<{ id: string; isActive: boolean }> = result
  void expected

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
