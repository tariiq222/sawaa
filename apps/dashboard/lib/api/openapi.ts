import { api } from "@/lib/api"
import type { paths } from "@/lib/types/api.generated"

type HttpMethod = "get" | "post" | "put" | "patch" | "delete"

type OperationAt<
  Path extends keyof paths,
  Method extends HttpMethod,
> = Method extends keyof paths[Path]
  ? Exclude<paths[Path][Method], undefined>
  : never

type PathsFor<Method extends HttpMethod> = {
  [Path in keyof paths]: [OperationAt<Path, Method>] extends [never]
    ? never
    : Path
}[keyof paths]

type OperationParameter<Operation, Kind extends "path" | "query"> =
  Operation extends { parameters: infer Parameters }
    ? Kind extends keyof Parameters
      ? Exclude<Parameters[Kind], undefined>
      : never
    : never

export type OpenApiRequestBody<
  Path extends keyof paths,
  Method extends HttpMethod,
> = OperationAt<Path, Method> extends {
  requestBody: { content: { "application/json": infer Body } }
}
  ? Body
  : never

type SuccessStatus = 200 | 201 | 202 | 204

type ResponseBody<Response> = Response extends {
  content: { "application/json": infer Body }
}
  ? Body
  : void

export type OpenApiResponse<
  Path extends keyof paths,
  Method extends HttpMethod,
> = OperationAt<Path, Method> extends { responses: infer Responses }
  ? ResponseBody<Responses[Extract<keyof Responses, SuccessStatus>]>
  : never

type RequestOptions<Operation, Body> =
  ([OperationParameter<Operation, "path">] extends [never]
    ? { path?: never }
    : { path: OperationParameter<Operation, "path"> }) &
    ([OperationParameter<Operation, "query">] extends [never]
      ? { query?: never }
      : { query?: OperationParameter<Operation, "query"> }) &
    ([Body] extends [never] ? { body?: never } : { body: Body })

type RequestArgs<Operation, Body> = [
  OperationParameter<Operation, "path">,
] extends [never]
  ? [Body] extends [never]
    ? [options?: RequestOptions<Operation, Body>]
    : [options: RequestOptions<Operation, Body>]
  : [options: RequestOptions<Operation, Body>]

type RuntimeOptions = {
  path?: Record<string, unknown>
  query?: Record<string, unknown>
  body?: unknown
}

function endpointFor(template: string, options?: RuntimeOptions): string {
  let endpoint = template.replace(/^\/api\/v1/, "")
  for (const [name, value] of Object.entries(options?.path ?? {})) {
    endpoint = endpoint.replace(`{${name}}`, encodeURIComponent(String(value)))
  }

  const query = new URLSearchParams()
  for (const [name, value] of Object.entries(options?.query ?? {})) {
    if (value === undefined || value === "") continue
    const values = Array.isArray(value) ? value : [value]
    for (const item of values) query.append(name, String(item))
  }
  const serialized = query.toString()
  return serialized ? `${endpoint}?${serialized}` : endpoint
}

function get<Path extends PathsFor<"get">>(
  path: Path,
  ...[options]: RequestArgs<OperationAt<Path, "get">, never>
): Promise<OpenApiResponse<Path, "get">> {
  return api.get(endpointFor(path, options as RuntimeOptions | undefined))
}

function post<Path extends PathsFor<"post">>(
  path: Path,
  ...[options]: RequestArgs<
    OperationAt<Path, "post">,
    OpenApiRequestBody<Path, "post">
  >
): Promise<OpenApiResponse<Path, "post">> {
  const runtimeOptions = options as RuntimeOptions | undefined
  return api.post(endpointFor(path, runtimeOptions), runtimeOptions?.body)
}

function put<Path extends PathsFor<"put">>(
  path: Path,
  ...[options]: RequestArgs<
    OperationAt<Path, "put">,
    OpenApiRequestBody<Path, "put">
  >
): Promise<OpenApiResponse<Path, "put">> {
  const runtimeOptions = options as RuntimeOptions | undefined
  return api.put(endpointFor(path, runtimeOptions), runtimeOptions?.body)
}

function patch<Path extends PathsFor<"patch">>(
  path: Path,
  ...[options]: RequestArgs<
    OperationAt<Path, "patch">,
    OpenApiRequestBody<Path, "patch">
  >
): Promise<OpenApiResponse<Path, "patch">> {
  const runtimeOptions = options as RuntimeOptions | undefined
  return api.patch(endpointFor(path, runtimeOptions), runtimeOptions?.body)
}

function remove<Path extends PathsFor<"delete">>(
  path: Path,
  ...[options]: RequestArgs<OperationAt<Path, "delete">, never>
): Promise<OpenApiResponse<Path, "delete">> {
  return api.delete(endpointFor(path, options as RuntimeOptions | undefined))
}

export const openApi = { get, post, put, patch, delete: remove }
