/** Clients API — controller: dashboard/people/clients. */

import {
  openApi,
  type OpenApiRequestBody,
  type OpenApiResponse,
} from "@/lib/api/openapi"
import type { PaginatedResponse } from "@/lib/types/common"
import type { Client, ClientListQuery } from "@/lib/types/client"

type ClientsPath = "/api/v1/dashboard/people/clients"
type ClientPath = "/api/v1/dashboard/people/clients/{id}"
type SetClientActivePath = "/api/v1/dashboard/people/clients/{id}/active"

type ClientWire = OpenApiResponse<ClientPath, "get">
type CreateClientBody = OpenApiRequestBody<ClientsPath, "post">
type CreateClientWire = OpenApiResponse<ClientsPath, "post">
type UpdateClientBody = OpenApiRequestBody<ClientPath, "patch">
type ClientBloodType = NonNullable<CreateClientBody["bloodType"]>

export interface CreateClientPayload {
  firstName: string
  middleName?: string
  lastName: string
  phone: string
  gender?: "male" | "female"
  dateOfBirth?: string
  nationality?: string
  nationalId?: string
  emergencyName?: string
  emergencyPhone?: string
  bloodType?: string
  allergies?: string
  chronicConditions?: string
  [key: string]: unknown
}

export interface CreateClientResponse {
  id: string
  firstName?: string
  middleName?: string
  lastName?: string
  phone?: string
  email?: string
  isExisting?: boolean
}

export interface UpdateClientPayload {
  firstName?: string
  middleName?: string
  lastName?: string
  phone?: string
  gender?: "male" | "female"
  dateOfBirth?: string
  nationality?: string
  nationalId?: string
  emergencyName?: string
  emergencyPhone?: string
  bloodType?: string
  allergies?: string
  chronicConditions?: string
  isActive?: boolean
  [key: string]: unknown
}

function toClient(client: ClientWire): Client {
  return {
    ...client,
    firstName: client.firstName ?? "",
    lastName: client.lastName ?? "",
    emailVerified: client.emailVerified !== null,
  }
}

function toCreateClientResponse(client: CreateClientWire): CreateClientResponse {
  return {
    id: client.id,
    firstName: client.firstName ?? undefined,
    middleName: client.middleName ?? undefined,
    lastName: client.lastName ?? undefined,
    phone: client.phone ?? undefined,
    email: client.email ?? undefined,
    isExisting: client.isExisting,
  }
}

function toClientBloodType(value?: string): ClientBloodType | undefined {
  switch (value) {
    case "A_POS": case "A_NEG": case "B_POS": case "B_NEG":
    case "AB_POS": case "AB_NEG": case "O_POS": case "O_NEG":
    case "UNKNOWN": case "a_pos": case "a_neg": case "b_pos":
    case "b_neg": case "ab_pos": case "ab_neg": case "o_pos":
    case "o_neg": case "unknown":
      return value
    case undefined:
    case "":
      return undefined
    default:
      throw new Error("Invalid client blood type")
  }
}

export async function fetchClients(
  query: ClientListQuery = {},
): Promise<PaginatedResponse<Client>> {
  const response = await openApi.get("/api/v1/dashboard/people/clients", {
    query: {
      page: query.page,
      limit: query.limit,
      search: query.search,
      ...(query.isActive !== undefined && { isActive: query.isActive }),
    },
  })
  return { ...response, items: response.items.map(toClient) }
}

export async function fetchClient(id: string): Promise<Client> {
  const client = await openApi.get("/api/v1/dashboard/people/clients/{id}", {
    path: { id },
  })
  return toClient(client)
}

function optionalText(value?: string): string | undefined {
  return value === "" ? undefined : value
}

export async function createWalkInClient(
  payload: CreateClientPayload,
): Promise<CreateClientResponse> {
  const body = {
    ...payload,
    firstName: payload.firstName,
    middleName: optionalText(payload.middleName),
    lastName: payload.lastName,
    phone: payload.phone,
    gender: payload.gender,
    dateOfBirth: optionalText(payload.dateOfBirth),
    nationality: optionalText(payload.nationality),
    nationalId: optionalText(payload.nationalId),
    emergencyName: optionalText(payload.emergencyName),
    emergencyPhone: optionalText(payload.emergencyPhone),
    bloodType: toClientBloodType(payload.bloodType),
    allergies: optionalText(payload.allergies),
    chronicConditions: optionalText(payload.chronicConditions),
  } satisfies CreateClientBody
  const client = await openApi.post("/api/v1/dashboard/people/clients", { body })
  return toCreateClientResponse(client)
}

export async function updateClient(
  id: string,
  payload: UpdateClientPayload,
): Promise<Client> {
  const body = {
    ...payload,
    firstName: optionalText(payload.firstName),
    middleName: optionalText(payload.middleName),
    lastName: optionalText(payload.lastName),
    phone: optionalText(payload.phone),
    gender: payload.gender,
    dateOfBirth: optionalText(payload.dateOfBirth),
    nationality: optionalText(payload.nationality),
    nationalId: optionalText(payload.nationalId),
    emergencyName: optionalText(payload.emergencyName),
    emergencyPhone: optionalText(payload.emergencyPhone),
    bloodType: toClientBloodType(payload.bloodType),
    allergies: optionalText(payload.allergies),
    chronicConditions: optionalText(payload.chronicConditions),
  } satisfies UpdateClientBody
  const client = await openApi.patch("/api/v1/dashboard/people/clients/{id}", {
    path: { id }, body,
  })
  return toClient(client)
}

export async function deleteClient(id: string): Promise<void> {
  return openApi.delete("/api/v1/dashboard/people/clients/{id}", {
    path: { id },
  })
}

export type SetClientActivePayload = OpenApiRequestBody<SetClientActivePath, "patch">

export type SetClientActiveResult = OpenApiResponse<SetClientActivePath, "patch">

export async function setClientActive(
  id: string,
  payload: SetClientActivePayload,
): Promise<SetClientActiveResult> {
  return openApi.patch("/api/v1/dashboard/people/clients/{id}/active", {
    path: { id },
    body: payload,
  })
}
