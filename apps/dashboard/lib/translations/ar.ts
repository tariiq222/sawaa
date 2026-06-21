/**
 * Arabic translations — Sawaa Dashboard
 *
 * This file is an index that merges all module translation files.
 * Each module file is kept under 350 lines.
 */

import { arNav } from "./ar.nav"
import { arDashboard } from "./ar.dashboard"
import { arBookings } from "./ar.bookings"
import { arClients } from "./ar.clients"
import { arEmployees } from "./ar.employees"
import { arServices } from "./ar.services"
import { arFinance } from "./ar.finance"
import { arUsers } from "./ar.users"
import { arSettings } from "./ar.settings"
import { arMisc } from "./ar.misc"
import { arIntakeForms } from "./ar.intake-forms"
import { arDepartments } from "./ar.departments"
import { arSms } from "./ar.sms"
import { arOps } from "./ar.ops"
import { arZoom } from "./ar.zoom"
import { arRegister } from "./ar.register"
import { arPrograms } from "./ar.programs"

export const ar: Record<string, string> = {
  ...arNav,
  ...arDashboard,
  ...arBookings,
  ...arClients,
  ...arEmployees,
  ...arServices,
  ...arFinance,
  ...arUsers,
  ...arSettings,
  ...arMisc,
  ...arIntakeForms,
  ...arDepartments,
  ...arSms,
  ...arOps,
  ...arZoom,
  ...arRegister,
  ...arPrograms,
}
