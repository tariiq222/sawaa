/**
 * Behaviour pin for every dashboard form schema.
 *
 * Each schema is fed a fixed set of probes — bare values, a realistic valid
 * form state, that state with one field changed at a time, and named
 * cross-field scenarios — directly (`safeParse`) and through `zodResolver`,
 * which is what react-hook-form shows to staff. The user-visible outcome
 * (accepted or not, the parsed value, each field's message) is compared with
 * `__fixtures__/zod-message-pins.txt`.
 *
 * A failure means a form now validates differently: a zod upgrade, an edit to
 * `lib/zod-setup.ts`, or a schema change. If the change is intended, re-record
 * and review the fixture diff:
 *   UPDATE_ZOD_PINS=1 pnpm --filter dashboard test -- zod-message-pins
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { zodResolver } from "@hookform/resolvers/zod"
import "@/lib/zod-setup"
import { FILE, factories, mirrors, modules, scenarios, valid, type AnySchema } from "./zod-pin-corpus"

type Result = { success: true; data: unknown } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } }
type Probe = [name: string, input: unknown]

const FIXTURE = path.join(__dirname, "__fixtures__", "zod-message-pins.txt")
const DASHBOARD_ROOT = path.resolve(__dirname, "../../../..")

/* ─── Probe values ─── */

const DELETE = Symbol("delete")
const LONG = "y".repeat(600)

/** Bare values fed to every schema as the whole input. */
const ROOT_VALUES: [string, unknown][] = [
  ["undefined", undefined], ["null", null], ["empty", ""], ["space", "   "], ["x", "x"],
  ["text-5", "5"], ["bad-email", "not-an-email"], ["email", "a@b.co"],
  ["id", "123e4567-e89b-42d3-a456-426614174000"],
  ["id-non-rfc", "00000000-0000-0000-0000-000000000001"], ["phone", "+966501234567"],
  ["-1", -1], ["0", 0], ["1", 1], ["1.5", 1.5], ["1000000", 1000000], ["NaN", Number.NaN],
  ["true", true], ["[]", []], ["['a']", ["a"]], ["[{}]", [{}]], ["{}", {}], ["MALE", "MALE"],
  ["long", LONG], ["file", FILE],
]

/** Values written into one field of an otherwise valid form state. */
const FIELD_VALUES: [string, unknown][] = [
  ["(removed)", DELETE], ["null", null], ["empty", ""], ["space", "   "], ["x", "x"],
  ["text-5", "5"], ["text-1.5", "1.5"], ["-1", -1], ["0", 0], ["1.5", 1.5],
  ["1000000", 1000000], ["NaN", Number.NaN], ["Infinity", Number.POSITIVE_INFINITY],
  ["2^53+2", 2 ** 53 + 2], ["id-non-rfc", "00000000-0000-0000-0000-000000000001"],
  ["[]", []], ["{}", {}], ["long", LONG],
]
const EN_FIELD_VALUES = FIELD_VALUES.filter(([name]) => ["(removed)", "empty", "x", "-1", "1000000"].includes(name))
/** A second broken field layered on a cross-field scenario. */
const SCENARIO_EXTRA_VALUES = FIELD_VALUES.filter(([name]) => ["empty", "1.5"].includes(name))

/* ─── Object helpers ─── */

const isPlain = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v) && !(v instanceof File)

function clone<T>(v: T): T {
  if (Array.isArray(v)) return v.map(clone) as T
  if (isPlain(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)])) as T
  return v
}

/**
 * Every path into a form state: fields, nested fields and array items — the
 * first two items of a top-level list, the first item of a list nested in one.
 */
function pathsOf(v: unknown, prefix = "", insideList = false): string[] {
  const entries: [string, unknown][] = Array.isArray(v)
    ? v.slice(0, insideList ? 1 : 2).map((x, i) => [String(i), x])
    : isPlain(v) ? Object.entries(v) : []
  return entries.flatMap(([k, x]) => {
    const p = prefix ? `${prefix}.${k}` : k
    return [p, ...pathsOf(x, p, insideList || Array.isArray(v))]
  })
}

function withValue(state: unknown, dotted: string, value: unknown): unknown {
  const root = clone(state) as Record<string, unknown>
  const keys = dotted.split(".")
  let cur: Record<string, unknown> = root
  for (const k of keys.slice(0, -1)) cur = cur[k] as Record<string, unknown>
  const last = keys[keys.length - 1]!
  if (value === DELETE) {
    if (Array.isArray(cur)) cur.splice(Number(last), 1)
    else delete cur[last]
  } else cur[last] = clone(value)
  return root
}

const withPatch = (state: unknown, patch: Record<string, unknown>): unknown =>
  Object.entries(patch).reduce((acc, [p, v]) => withValue(acc, p, v), state)

function ser(v: unknown): string {
  if (v === undefined) return "undefined"
  return JSON.stringify(v, (_k, x) => {
    if (typeof x === "number" && !Number.isFinite(x)) return `__${x}`
    if (x === undefined) return "__undefined"
    if (x instanceof File) return "__File"
    if (x === LONG) return "__long"
    return x
  })
}

/** Where the parsed value differs from the input (trimming, coercion, defaults). */
function changes(input: unknown, output: unknown, at = ""): string[] {
  if ((Array.isArray(input) && Array.isArray(output)) || (isPlain(input) && isPlain(output))) {
    const a = input as Record<string, unknown>
    const b = output as Record<string, unknown>
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((k) =>
      changes(a[k], b[k], at ? `${at}.${k}` : k),
    )
  }
  return Object.is(input, output) ? [] : [`${at}: ${ser(input)} → ${ser(output)}`]
}

/* ─── Running one probe ─── */

const pair = (issuePath: PropertyKey[] | string, message: string) =>
  `${typeof issuePath === "string" ? issuePath : issuePath.join(".")}: ${message}`

function flattenResolverErrors(node: unknown, at: string, out: string[]) {
  if (!node || typeof node !== "object") return
  const o = node as Record<string, unknown>
  if (typeof o.message === "string" && "type" in o) out.push(pair(at, o.message))
  else for (const k of Object.keys(o)) flattenResolverErrors(o[k], at ? `${at}.${k}` : k, out)
}

/**
 * `<direct outcome> || <form outcome>`. The form side is "=" when the form
 * shows exactly the first direct message of each field (or accepts the same
 * value), which is the normal case.
 */
async function run(schema: AnySchema, input: unknown): Promise<string> {
  const direct = schema.safeParse(input) as Result
  const directText = direct.success
    ? ["OK", ...changes(input, direct.data)].join(" ~ ")
    : `ERR ${direct.error.issues.map((i) => pair(i.path, i.message)).join(" | ")}`

  let formText: string
  try {
    const resolve = zodResolver(schema as never) as unknown as (
      values: unknown, context: unknown, options: unknown,
    ) => Promise<{ values: unknown; errors: Record<string, unknown> }>
    const form = await resolve(clone(input), undefined, {
      fields: {}, criteriaMode: "firstError", shouldUseNativeValidation: false,
    })
    if (Object.keys(form.errors ?? {}).length) {
      const shown: string[] = []
      flattenResolverErrors(form.errors, "", shown)
      shown.sort()
      const seen = new Set<string>()
      const firstPerField = direct.success ? [] : direct.error.issues
        .filter((i) => !seen.has(i.path.join(".")) && seen.add(i.path.join(".")))
        .map((i) => pair(i.path, i.message))
        .sort()
      formText = ser(shown) === ser(firstPerField) ? "=" : `ERR ${shown.join(" | ")}`
    } else {
      const formOk = ["OK", ...changes(input, form.values)].join(" ~ ")
      formText = formOk === directText ? "=" : formOk
    }
  } catch (e) {
    formText = `THROW ${String((e as Error).message).slice(0, 120)}`
  }
  return `${directText} || ${formText}`
}

/* ─── Collecting ─── */

function allSchemas(): Record<string, AnySchema> {
  const isSchema = (v: unknown): v is AnySchema =>
    !!v && typeof v === "object" && typeof (v as AnySchema).safeParse === "function"
  const all: Record<string, AnySchema> = {}
  for (const [moduleName, mod] of Object.entries(modules))
    for (const [exportName, v] of Object.entries(mod)) if (isSchema(v)) all[`${moduleName}.${exportName}`] = v
  for (const [name, build] of Object.entries(factories)) all[name] = build()
  for (const [name, mirror] of Object.entries(mirrors)) all[name] = mirror.build()
  return Object.fromEntries(Object.keys(all).sort().map((name) => [name, all[name]!]))
}

function probesFor(name: string): Probe[] {
  const probes: Probe[] = ROOT_VALUES.map(([vn, v]) => [`root = ${vn}`, v])
  const state = valid[name]
  probes.push(["valid", clone(state)])
  if (!isPlain(state)) return probes
  for (const p of pathsOf(state))
    for (const [vn, v] of FIELD_VALUES) probes.push([`${p} = ${vn}`, withValue(state, p, v)])
  for (const [scenario, patch] of Object.entries(scenarios[name] ?? {})) {
    const broken = withPatch(state, patch)
    probes.push([`scenario: ${scenario}`, broken])
    for (const [key, current] of Object.entries(state)) {
      // Only fields a person types into; a patched field is already broken.
      if (key in patch || !["string", "number"].includes(typeof current)) continue
      for (const [vn, v] of SCENARIO_EXTRA_VALUES)
        probes.push([`scenario: ${scenario} + ${key} = ${vn}`, withValue(broken, key, v)])
    }
  }
  return probes
}

function enProbesFor(name: string): Probe[] {
  const state = valid[name]
  const probes: Probe[] = [["en: root = undefined", undefined]]
  if (!isPlain(state)) {
    for (const [vn, v] of ROOT_VALUES.filter(([n]) => ["empty", "x", "-1", "1000000", "bad-email"].includes(n)))
      probes.push([`en: root = ${vn}`, v])
    return probes
  }
  for (const key of Object.keys(state))
    for (const [vn, v] of EN_FIELD_VALUES) probes.push([`en: ${key} = ${vn}`, withValue(state, key, v)])
  return probes
}

type Pins = Record<string, Record<string, string>>

async function collect(): Promise<Pins> {
  const pins: Pins = {}
  for (const [name, schema] of Object.entries(allSchemas())) {
    const outcomes: Record<string, string> = {}
    window.localStorage.setItem("sawaa-locale", "ar")
    for (const [probe, input] of probesFor(name)) outcomes[probe] = await run(schema, input)
    window.localStorage.setItem("sawaa-locale", "en")
    for (const [probe, input] of enProbesFor(name)) outcomes[probe] = await run(schema, input)
    pins[name] = outcomes
  }
  window.localStorage.setItem("sawaa-locale", "ar")
  return pins
}

/* ─── Fixture: per schema, each outcome followed by the probes that produce it ─── */

function format(pins: Pins): string {
  const out: string[] = []
  for (const [name, outcomes] of Object.entries(pins)) {
    out.push(`## ${name}`)
    const byOutcome = new Map<string, string[]>()
    for (const [probe, outcome] of Object.entries(outcomes))
      byOutcome.set(outcome, [...(byOutcome.get(outcome) ?? []), probe])
    for (const [outcome, probes] of byOutcome) {
      out.push(`> ${outcome}`)
      for (const probe of probes) out.push(`  ${probe}`)
    }
    out.push("")
  }
  return out.join("\n")
}

function parse(text: string): Pins {
  const pins: Pins = {}
  let schema = ""
  let outcome = ""
  for (const line of text.split("\n")) {
    if (line.startsWith("## ")) pins[(schema = line.slice(3))] = {}
    else if (line.startsWith("> ")) outcome = line.slice(2)
    else if (line.startsWith("  ")) pins[schema]![line.slice(2)] = outcome
  }
  return pins
}

describe("dashboard form schema behaviour pins", () => {
  it("has a valid form state for every schema", () => {
    const names = Object.keys(allSchemas())
    expect(Object.keys(valid).sort()).toEqual(names)
    const rejected = names.filter((name) => !allSchemas()[name]!.safeParse(clone(valid[name])).success)
    expect(rejected).toEqual([])
  })

  it("keeps the mirrored inline schemas identical to their components", () => {
    for (const mirror of Object.values(mirrors)) {
      const source = readFileSync(path.join(DASHBOARD_ROOT, mirror.file), "utf8")
      expect(source, mirror.file).toContain(mirror.source)
    }
  })

  it("matches the recorded outcome of every probe", async () => {
    const actual = await collect()
    if (process.env.UPDATE_ZOD_PINS === "1") {
      writeFileSync(FIXTURE, format(actual))
      return
    }
    expect(existsSync(FIXTURE), "fixture missing — record it with UPDATE_ZOD_PINS=1").toBe(true)
    const expected = parse(readFileSync(FIXTURE, "utf8"))
    const differences: string[] = []
    for (const name of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
      const exp = expected[name] ?? {}
      const act = actual[name] ?? {}
      for (const probe of new Set([...Object.keys(exp), ...Object.keys(act)])) {
        if (exp[probe] !== act[probe])
          differences.push(`${name} :: ${probe}\n   recorded: ${exp[probe] ?? "(none)"}\n   now:      ${act[probe] ?? "(none)"}`)
      }
    }
    const shown = differences.slice(0, 25).join("\n")
    expect(differences.length, `${differences.length} probe(s) changed:\n${shown}`).toBe(0)
  }, 180_000)
})
