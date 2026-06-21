/**
 * English translations — Sawaa Dashboard
 *
 * This file is an index that merges all module translation files.
 * Each module file is kept under 350 lines.
 */

import { enNav } from "./en.nav"
import { enDashboard } from "./en.dashboard"
import { enBookings } from "./en.bookings"
import { enClients } from "./en.clients"
import { enEmployees } from "./en.employees"
import { enServices } from "./en.services"
import { enFinance } from "./en.finance"
import { enUsers } from "./en.users"
import { enSettings } from "./en.settings"
import { enMisc } from "./en.misc"
import { enIntakeForms } from "./en.intake-forms"
import { enDepartments } from "./en.departments"
import { enSms } from "./en.sms"
import { enOps } from "./en.ops"
import { enZoom } from "./en.zoom"
import { enRegister } from "./en.register"
import { enPrograms } from "./en.programs"

export const en: Record<string, string> = {
  ...enNav,
  ...enDashboard,
  ...enBookings,
  ...enClients,
  ...enEmployees,
  ...enServices,
  ...enFinance,
  ...enUsers,
  ...enSettings,
  ...enMisc,
  ...enIntakeForms,
  ...enDepartments,
  ...enSms,
  ...enOps,
  ...enZoom,
  ...enRegister,
  ...enPrograms,
}
