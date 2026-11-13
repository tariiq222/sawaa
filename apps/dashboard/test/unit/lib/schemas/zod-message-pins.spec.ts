/**
 * MNT-15 behaviour pin for the zod 3 → 4 migration.
 *
 * Feeds a fixed probe corpus through every dashboard form schema (directly via
 * `safeParse` and through `zodResolver`, which is what react-hook-form shows
 * to staff) and compares the user-visible output — issue path + message, or
 * the parsed value on success — against a fixture that was RECORDED ON ZOD 3.
 * Any difference after the migration is a user-visible behaviour change.
 *
 * Re-record only deliberately: `UPDATE_ZOD_PINS=1 pnpm --filter dashboard test -- zod-message-pins`.
 */
import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { zodResolver } from "@hookform/resolvers/zod"
import "@/lib/zod-setup"

import * as authLogin from "@/lib/schemas/auth-login.schema"
import * as blogPosts from "@/lib/schemas/blog-posts.schema"
import * as booking from "@/lib/schemas/booking.schema"
import * as branch from "@/lib/schemas/branch.schema"
import * as client from "@/lib/schemas/client.schema"
import * as coupon from "@/lib/schemas/coupon.schema"
import * as department from "@/lib/schemas/department.schema"
import * as employee from "@/lib/schemas/employee.schema"
import * as faq from "@/lib/schemas/faq.schema"
import * as featureCards from "@/lib/schemas/feature-cards.schema"
import * as hero from "@/lib/schemas/hero.schema"
import * as packageGroups from "@/lib/schemas/package-groups.schema"
import * as pkg from "@/lib/schemas/package.schema"
import * as payment from "@/lib/schemas/payment.schema"
import * as program from "@/lib/schemas/program.schema"
import * as sectionIntros from "@/lib/schemas/section-intros.schema"
import * as service from "@/lib/schemas/service.schema"
import * as supportGroups from "@/lib/schemas/support-groups.schema"
import * as user from "@/lib/schemas/user.schema"
import * as serviceCreate from "@/components/features/services/create/form-schema"
import * as employeeCreate from "@/components/features/employees/create/form-schema"
import * as draftService from "@/components/features/employees/create/draft-service.types"
import * as scheduleEditor from "@/components/features/employees/schedule-editor.types"
import { z } from "zod"

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnySchema = { safeParse: (v: unknown) => any }

const t = (k: string) => `T(${k})`

const modules: Record<string, Record<string, unknown>> = {
  authLogin, blogPosts, booking, branch, client, coupon, department, employee, faq,
  featureCards, hero, packageGroups, pkg, payment, program, sectionIntros, service,
  supportGroups, user, serviceCreate, employeeCreate, draftService, scheduleEditor,
}

/** Schema factories, called with a recognisable `t`. */
const factories: Record<string, () => AnySchema> = {
  "booking.createWalkInClientSchema": () => booking.createWalkInClientSchema(t) as any,
  "booking.createBookingCreateSchema": () => booking.createBookingCreateSchema(t) as any,
  "booking.createRescheduleBookingSchema": () => booking.createRescheduleBookingSchema(t) as any,
  "client.createClientSchemaWithI18n": () => client.createClientSchemaWithI18n(t) as any,
  "employee.createEmployeeEmailSchema(t)": () => employee.createEmployeeEmailSchema(t) as any,
  "employee.createEmployeeEmailSchema()": () => employee.createEmployeeEmailSchema() as any,
  "program.buildCreateProgramSchema": () => program.buildCreateProgramSchema(t) as any,
  "program.buildScheduleProgramSchema": () => program.buildScheduleProgramSchema(t) as any,
  "program.buildCancelProgramSchema": () => program.buildCancelProgramSchema(t) as any,
  "program.buildEnrollInProgramSchema": () => program.buildEnrollInProgramSchema(t) as any,
  "serviceCreate.createServiceEditSchema(saved)": () => serviceCreate.createServiceEditSchema("Saved") as any,
  "serviceCreate.createServiceEditSchema()": () => serviceCreate.createServiceEditSchema() as any,
  "employeeCreate.createEmployeeSchema(t)": () => employeeCreate.createEmployeeSchema(t) as any,
  "employeeCreate.createEmployeeSchema()": () => employeeCreate.createEmployeeSchema() as any,
}

/**
 * Inline schemas that live inside components (not exported). They mirror the
 * exact expressions in the named files so the primitive behaviours they depend
 * on (email, min/regex messages, refine on confirm password) are pinned too.
 */
const mirrors: Record<string, () => AnySchema> = {
  "forgot-password-form:emailSchema": () => z.string().email(),
  "login/combined-step:passwordSchema": () => z.string().min(8, { message: "INVALID_PASSWORD" }),
  "reset-password-form:strongPasswordSchema": () => z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
  "change-password-dialog:buildSchema": () =>
    z
      .object({
        currentPassword: z.string().min(1, t("changePassword.currentRequired")),
        newPassword: z.string().min(8, t("changePassword.newTooShort")),
        confirmPassword: z.string().min(1, t("changePassword.confirmRequired")),
      })
      .refine((d) => d.newPassword === d.confirmPassword, {
        message: t("changePassword.mismatch"),
        path: ["confirmPassword"],
      }),
  "mobile-style:email": () => z.string().email(),
  "mobile-style:profile": () => z.object({ name: z.string().trim().min(1, "required") }),
}

function isSchema(v: unknown): v is AnySchema {
  return !!v && typeof v === "object" && typeof (v as any).safeParse === "function"
}

function shapeOf(schema: any): Record<string, unknown> | null {
  let cur = schema
  for (let i = 0; i < 6 && cur; i++) {
    if (cur.shape && typeof cur.shape === "object") return cur.shape
    cur = cur._def?.schema ?? cur._def?.innerType ?? cur._def?.in ?? cur._def?.left ?? null
  }
  return null
}

const FILE = typeof File === "undefined" ? "FILE" : new File(["x"], "a.png")
const ALL_VALUES: [string, unknown][] = [
  ["null", null],
  ["empty", ""],
  ["space", "   "],
  ["x", "x"],
  ["num5str", "5"],
  ["bad-email", "not-an-email"],
  ["email", "a@b.co"],
  ["uuid-v4", "123e4567-e89b-42d3-a456-426614174000"],
  ["uuid-loose", "00000000-0000-0000-0000-000000000001"],
  ["plus-phone", "+966501234567"],
  ["neg1", -1],
  ["zero", 0],
  ["one", 1],
  ["float", 1.5],
  ["big", 1000000],
  ["nan", Number.NaN],
  ["true", true],
  ["empty-arr", []],
  ["arr-str", ["a"]],
  ["arr-obj", [{}]],
  ["obj", {}],
  ["MALE", "MALE"],
  ["long600", "y".repeat(600)],
  ["file", FILE],
]
const NAMES_ALL = ["null", "empty", "x", "num5str", "bad-email", "uuid-loose", "plus-phone", "neg1", "float", "big", "nan", "empty-arr", "arr-obj", "obj", "MALE", "long600", "file"]
const NAMES_KEY = ["null", "empty", "x", "bad-email", "email", "uuid-loose", "uuid-v4", "num5str", "MALE", "neg1", "float", "nan", "arr-obj", "long600"]
const NAMES_EN = ["empty", "x", "neg1", "big", "bad-email"]
const KEY_VALUES: [string, unknown][] = ALL_VALUES.filter(([n]) => NAMES_KEY.includes(n))
const ROOT_VALUES: [string, unknown][] = [["undefined", undefined], ...ALL_VALUES]

function ser(v: unknown): string {
  return JSON.stringify(v, (_k, x) => {
    if (typeof x === "number" && Number.isNaN(x)) return "__NaN"
    if (x === undefined) return "__undefined"
    if (typeof File !== "undefined" && x instanceof File) return "__File"
    if (typeof x === "string" && x.length > 40 && /^y+$/.test(x)) return `__y${x.length}`
    return x
  })
}

function setLocale(l: "ar" | "en") {
  window.localStorage.setItem("sawaa-locale", l)
}

async function run(schema: AnySchema, input: unknown): Promise<string> {
  const r = schema.safeParse(input)
  let out: string
  if (r.success) out = `OK ${ser(r.data)}`
  else out = "ERR " + r.error.issues.map((i: any) => `${i.path.join(".")}: ${i.message}`).join(" | ")
  let res = ""
  try {
    const rr: any = await (zodResolver(schema as any) as any)(input, undefined, {
      fields: {},
      criteriaMode: "firstError",
      shouldUseNativeValidation: false,
    })
    const flat: string[] = []
    const walk = (o: any, p: string) => {
      if (!o || typeof o !== "object") return
      if (typeof o.message === "string" && "type" in o) { flat.push(`${p}: ${o.message}`); return }
      for (const k of Object.keys(o)) walk(o[k], p ? `${p}.${k}` : k)
    }
    walk(rr.errors, "")
    res = Object.keys(rr.errors ?? {}).length ? "RERR " + flat.join(" | ") : `ROK ${ser(rr.values)}`
  } catch (e) {
    res = "RTHROW " + String((e as Error).message).slice(0, 120)
  }
  // Compact: when the resolver shows exactly the first issue per path (the
  // usual case) store just "R=" instead of repeating the list.
  // Field order from @hookform/resolvers differs between zod versions; each
  // field renders its own message, so compare the (field, message) set. Split
  // only at the start of a new "field: " pair, not inside "'a' | 'b'" copy.
  const splitPairs = (text: string): string[] =>
    text.split(/ \| (?=[A-Za-z0-9_.\[\]-]*: )/)
  if (res.startsWith("RERR ")) {
    res = "RERR " + splitPairs(res.slice(5)).sort().join(" | ")
  }
  if (!r.success && res.startsWith("RERR ")) {
    const seen = new Set<string>()
    const firstPerPath = r.error.issues
      .filter((i: any) => { const p = i.path.join("."); if (seen.has(p)) return false; seen.add(p); return true })
      .map((i: any) => `${i.path.join(".")}: ${i.message}`)
      .sort()
    if ("RERR " + firstPerPath.join(" | ") === res) res = "R="
  } else if (r.success && res === `ROK ${out.slice(3)}`) res = "R="
  return `${out} || ${res}`
}

async function collect(): Promise<Record<string, Record<string, string>>> {
  const all: Record<string, AnySchema> = {}
  for (const [mn, mod] of Object.entries(modules))
    for (const [en, v] of Object.entries(mod)) if (isSchema(v)) all[`${mn}.${en}`] = v
  for (const [n, f] of Object.entries(factories)) all[n] = f()
  for (const [n, f] of Object.entries(mirrors)) all[n] = f()

  const out: Record<string, Record<string, string>> = {}
  for (const name of Object.keys(all).sort()) {
    const schema = all[name]!
    const cases: Record<string, string> = {}
    const keys = Object.keys(shapeOf(schema) ?? {})
    for (const loc of ["ar", "en"] as const) {
      setLocale(loc)
      for (const [vn, v] of ROOT_VALUES) {
        if (loc === "en" && vn !== "undefined" && !NAMES_EN.includes(vn)) continue
        cases[`${loc}|root=${vn}`] = await run(schema, v)
      }
      for (const [vn, v] of ALL_VALUES) {
        if (!keys.length) break
        if (!NAMES_ALL.includes(vn) || (loc === "en" && !NAMES_EN.includes(vn))) continue
        cases[`${loc}|all=${vn}`] = await run(schema, Object.fromEntries(keys.map((k) => [k, v])))
      }
    }
    setLocale("ar")
    for (const k of keys)
      for (const [vn, v] of KEY_VALUES) cases[`ar|${k}=${vn}`] = await run(schema, { [k]: v })
    out[name] = cases
  }
  setLocale("ar")
  return out
}

const FIXTURE = path.join(__dirname, "__fixtures__", "zod-message-pins.json")

type Fixture = { strings: string[]; cases: Record<string, Record<string, number>> }

function intern(actual: Record<string, Record<string, string>>): Fixture {
  const strings: string[] = []
  const index = new Map<string, number>()
  const cases: Fixture["cases"] = {}
  for (const [n, cs] of Object.entries(actual)) {
    cases[n] = {}
    for (const [k, v] of Object.entries(cs)) {
      let i = index.get(v)
      if (i === undefined) { i = strings.length; strings.push(v); index.set(v, i) }
      cases[n]![k] = i
    }
  }
  return { strings, cases }
}

describe("MNT-15 zod message/behaviour pins (recorded on zod 3)", () => {
  it("matches the recorded fixture for every schema/probe", async () => {
    const actual = await collect()
    if (process.env.UPDATE_ZOD_PINS === "1") {
      const f = intern(actual)
      const lines = Object.entries(f.cases).map(
        ([n, cs]) => `  ${JSON.stringify(n)}: ${JSON.stringify(cs)}`,
      )
      writeFileSync(
        FIXTURE,
        `{\n "strings": [\n${f.strings.map((x) => "  " + JSON.stringify(x)).join(",\n")}\n ],\n "cases": {\n${lines.join(",\n")}\n }\n}\n`,
      )
      return
    }
    const fx: Fixture = JSON.parse(readFileSync(FIXTURE, "utf8"))
    // The fixture was recorded before resolver field order was normalised;
    // normalise it on read so both sides compare the (field, message) set.
    /**
     * User-visible signature of a probe: the ordered issue list plus the set of
     * (field, message) pairs the resolver would render. Shape differences such
     * as "R=" vs "RERR <same pairs>" or resolver field ordering are not visible
     * (each input renders its own message), so they are collapsed.
     */
    const firstPerPath = (parts: string[]): string[] => {
      const seen = new Set<string>()
      const out: string[] = []
      for (const part of parts) {
        const sep = part.indexOf(": ")
        const field = sep === -1 ? part : part.slice(0, sep)
        if (seen.has(field)) continue
        seen.add(field)
        out.push(part)
      }
      return out
    }
    /**
     * Zod 4 keeps collecting further issues on a path after a type error where
     * zod 3 short-circuited. A form field renders one message (react-hook-form
     * default `criteriaMode: "firstError"`), so only the first issue per path is
     * user-visible.
     */
    const signature = (x: string): string => {
      const [parsePart, resolverPart = ""] = x.split(" || ")
      // Split on the " | " separator only when it starts a new "field: " pair;
      // expected-type messages like "'a' | 'b'" contain the same characters.
      const splitPairs = (text: string): string[] =>
        text.split(/ \| (?=[A-Za-z0-9_.\[\]-]+: )/)
      const issues = firstPerPath(splitPairs(parsePart.replace(/^(ERR|OK) /, ""))).sort()
      // "R=" / "ROK <value>" compaction means the resolver showed exactly the
      // first issue per path (or accepted the value), so reuse the parse side.
      const resolverPairs = /^R=|^ROK /.test(resolverPart)
        ? issues
        : splitPairs(resolverPart.replace(/^R(ERR|OK|THROW) /, "")).sort()
      return `${issues.join("|")}##${resolverPairs.join("|")}`
    }
    const fixSig = new Map<string, string>()
    fx.strings.forEach((x, i) => fixSig.set(String(i), signature(x)))
    const allDiffs: string[] = []
    expect(Object.keys(actual)).toEqual(Object.keys(fx.cases))
    for (const name of Object.keys(fx.cases)) {
      const diffs: string[] = []
      const exp = fx.cases[name]!
      const act = actual[name]!
      for (const k of new Set([...Object.keys(exp), ...Object.keys(act)])) {
        const idx = exp[k]
        const e = idx === undefined ? undefined : fixSig.get(String(idx))
        const a = act[k] === undefined ? undefined : signature(act[k]!)
        if (e !== a) {
          diffs.push(`${k}\n   expected: ${idx === undefined ? "-" : fx.strings[idx]!}\n   actual:   ${act[k] ?? "-"}`)
        }
      }
      if (diffs.length) allDiffs.push(`${name}: ${diffs.length} differing probe(s)\n${diffs.join("\n")}`)
    }
    if (allDiffs.length) {
      writeFileSync(path.join(__dirname, "__fixtures__", "zod4-diff.txt"), allDiffs.join("\n\n"))
    }
    expect(allDiffs.length, `${allDiffs.length} schema(s) differ; see zod4-diff.txt`).toBe(0)
  }, 120_000)
})
