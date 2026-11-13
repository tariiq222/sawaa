/**
 * Corpus for `zod-message-pins.spec.ts`: every dashboard form schema, one
 * realistic valid form state per object schema, and the cross-field scenarios
 * worth pinning. Adding a schema file means registering it here.
 */
import { z } from "zod"

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
import { emailAddress } from "@/lib/schemas/primitives"
import { FEATURE_CARD_ICON_OPTIONS } from "@/lib/types/feature-cards"

export type AnySchema = { safeParse: (value: unknown) => { success: boolean } }
type Obj = Record<string, unknown>

/** Translator stand-in: makes translated messages recognisable in the pins. */
const t = (key: string) => `T(${key})`

const asSchema = (schema: unknown) => schema as AnySchema

/** Modules whose exported schemas are pinned as-is. */
export const modules: Record<string, Record<string, unknown>> = {
  authLogin, blogPosts, booking, branch, client, coupon, department, employee, faq,
  featureCards, hero, packageGroups, pkg, payment, program, sectionIntros, service,
  supportGroups, user, serviceCreate, employeeCreate, draftService, scheduleEditor,
}

/** Schema factories, called with a recognisable `t`. */
export const factories: Record<string, () => AnySchema> = {
  "booking.createWalkInClientSchema": () => asSchema(booking.createWalkInClientSchema(t)),
  "booking.createBookingCreateSchema": () => asSchema(booking.createBookingCreateSchema(t)),
  "booking.createRescheduleBookingSchema": () => asSchema(booking.createRescheduleBookingSchema(t)),
  "client.createClientSchemaWithI18n": () => asSchema(client.createClientSchemaWithI18n(t)),
  "employee.createEmployeeEmailSchema(t)": () => asSchema(employee.createEmployeeEmailSchema(t)),
  "employee.createEmployeeEmailSchema()": () => asSchema(employee.createEmployeeEmailSchema()),
  "program.buildCreateProgramSchema": () => asSchema(program.buildCreateProgramSchema(t)),
  "program.buildScheduleProgramSchema": () => asSchema(program.buildScheduleProgramSchema(t)),
  "program.buildCancelProgramSchema": () => asSchema(program.buildCancelProgramSchema(t)),
  "program.buildEnrollInProgramSchema": () => asSchema(program.buildEnrollInProgramSchema(t)),
  "serviceCreate.createServiceEditSchema(saved)": () => asSchema(serviceCreate.createServiceEditSchema("Saved")),
  "serviceCreate.createServiceEditSchema()": () => asSchema(serviceCreate.createServiceEditSchema()),
  "employeeCreate.createEmployeeSchema(t)": () => asSchema(employeeCreate.createEmployeeSchema(t)),
  "employeeCreate.createEmployeeSchema()": () => asSchema(employeeCreate.createEmployeeSchema()),
}

/**
 * Schemas declared inline inside components (not exported). Each mirror
 * repeats the component's expression; `source` is asserted to still appear in
 * `file`, so a mirror cannot silently drift from the component.
 */
export const mirrors: Record<string, { file: string; source: string; build: () => AnySchema }> = {
  "forgot-password-form:emailSchema": {
    file: "components/features/forgot-password-form.tsx",
    source: "const emailSchema = emailAddress()",
    build: () => emailAddress(),
  },
  "login/combined-step:passwordSchema": {
    file: "components/features/login/combined-step.tsx",
    source: 'const passwordSchema = z.string().min(8, { message: "INVALID_PASSWORD" })',
    build: () => z.string().min(8, { message: "INVALID_PASSWORD" }),
  },
  "reset-password-form:strongPasswordSchema": {
    file: "components/features/reset-password-form.tsx",
    source: "const strongPasswordSchema = z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/)",
    build: () => z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
  },
  "change-password-dialog:buildSchema": {
    file: "components/features/change-password-dialog.tsx",
    source: `  return z
    .object({
      currentPassword: z.string().min(1, t("changePassword.currentRequired")),
      newPassword: z.string().min(8, t("changePassword.newTooShort"))
        .regex(/[A-Z]/, t("auditStaff.passwordUppercase"))
        .regex(/[0-9]/, t("auditStaff.passwordDigit")),
      confirmPassword: z.string().min(1, t("changePassword.confirmRequired")),
    })
    .refine((d) => d.newPassword === d.confirmPassword, {
      message: t("changePassword.mismatch"),
      path: ["confirmPassword"],
    })`,
    build: () =>
      z
        .object({
          currentPassword: z.string().min(1, t("changePassword.currentRequired")),
          newPassword: z.string().min(8, t("changePassword.newTooShort"))
            .regex(/[A-Z]/, t("auditStaff.passwordUppercase"))
            .regex(/[0-9]/, t("auditStaff.passwordDigit")),
          confirmPassword: z.string().min(1, t("changePassword.confirmRequired")),
        })
        .refine((d) => d.newPassword === d.confirmPassword, {
          message: t("changePassword.mismatch"),
          path: ["confirmPassword"],
        }),
  },
}

/* ─── Valid form states ─── */

const ID = "123e4567-e89b-42d3-a456-426614174000"
const ID2 = "00000000-0000-4000-8000-000000000002"
export const FILE = new File(["x"], "avatar.png")

const person = {
  fullName: "سارة أحمد", gender: "female", dateOfBirth: "1990-01-01", nationality: "SA",
  nationalId: "1234567890", phone: "+966501234567", emergencyName: "أحمد",
  emergencyPhone: "+966501234568", bloodType: "A_POS", allergies: "لا يوجد", chronicConditions: "",
}
const bookingCreate = {
  employeeId: ID, serviceId: ID2, type: "in_person", durationOptionId: "opt-1",
  date: "2026-12-01", startTime: "10:00", payAtClinic: false,
}
const reschedule = { date: "2026-12-01", startTime: "10:00" }
const employeeForm = {
  title: "د.", nameEn: "Sara Ahmed", nameAr: "سارة أحمد", email: "sara@example.com",
  phone: "+966501234567", gender: "FEMALE", employmentType: "FULL_TIME", specialty: "Family therapy",
  specialtyAr: "علاج أسري", bio: "Bio", bioAr: "نبذة", experience: 5, education: "PhD",
  educationAr: "دكتوراه", avatarUrl: "https://example.com/a.png", avatarFile: FILE,
  branchIds: [ID], serviceIds: [ID2], isActive: true, isPublic: false,
}
const employeeService = { serviceId: ID, bufferMinutes: 10, isActive: true }
const faqItem = { q: "سؤال", qEn: "Question", a: "جواب", aEn: "Answer" }
const blogPost = {
  slug: "post-1", title: "عنوان", titleEn: "Title", date: "2026-11-01", tag: "أسرة",
  tagEn: "Family", author: "سارة", image: "/img.png", content: "نص المقال",
}
const featureCard = { label: "وسم", title: "عنوان", desc: "وصف", icon: FEATURE_CARD_ICON_OPTIONS[0] }
const heroForm = {
  badgeText: "شارة", titlePrefix: "بداية", titleHighlight: "مميّز", titleSuffix: "نهاية",
  subtitle: "وصف", ctaPrimaryText: "احجز", ctaPrimaryHref: "/book", ctaSecondaryText: "تعرّف",
  ctaSecondaryHref: "https://example.com/about", heroImageUrl: "/hero.png",
  badgeFloatTopLabel: "أعلى", badgeFloatTopValue: "10", badgeFloatBottomLabel: "أسفل",
  badgeFloatBottomValue: "20",
}
const groupedSession = {
  key: "s1", position: 0, durationOptionId: "opt-1", deliveryType: "IN_PERSON",
  unitPriceSar: 150, hasUnitPriceOverride: false,
}
const groupedGroup = {
  key: "g1", label: "المجموعة الأولى", serviceId: ID, employeeId: ID2, sequenceMode: "ORDERED",
  dependsOnGroupKey: null, sessionMode: "SAME", sameApplied: true,
  sessions: [groupedSession, { ...groupedSession, key: "s2", position: 1 }],
}
const groupedPackage = {
  nameAr: "باقة", nameEn: "Package", descriptionAr: "وصف", descriptionEn: "Description",
  imageUrl: null, iconName: "heart", iconBgColor: "#ffffff", sortOrder: 0, isActive: true,
  isPublic: true,
  groups: [groupedGroup, { ...groupedGroup, key: "g2", dependsOnGroupKey: "g1" }],
  globalDiscount: { type: "PERCENTAGE", value: 10 },
}
const anyScope = { mode: "ANY", ids: [] as string[] }
const flexibleItem = {
  selectionMode: "FLEXIBLE",
  originalConstraints: [{ dimension: "SERVICE", mode: "INCLUDE", targetIds: [ID] }],
  hasUnitPriceOverride: false, priceUnavailable: false, priceResetNotice: false,
  service: { mode: "INCLUDE", ids: [ID] }, practitioner: anyScope, duration: anyScope,
  delivery: anyScope, unitPriceSar: 200, paidQuantity: 4, freeQuantity: 1,
  discountType: "PERCENTAGE", discountValue: 10, label: "جلسات", sortOrder: 0,
}
const fixedItem = {
  selectionMode: "FIXED", service: { mode: "INCLUDE", ids: [ID] },
  practitioner: { mode: "INCLUDE", ids: [ID2] }, duration: { mode: "INCLUDE", ids: ["opt-1"] },
  delivery: anyScope, paidQuantity: 2, freeQuantity: 0, discountType: null,
}
const packageForm = {
  nameAr: "باقة", nameEn: "Package", descriptionAr: "", descriptionEn: "", imageUrl: null,
  iconName: null, iconBgColor: null, sortOrder: 0, isActive: true, isPublic: true,
  ownerEmployeeId: ID, ownerChangeRevision: 0, items: [flexibleItem, fixedItem],
}
const programForm = {
  departmentId: ID, branchId: ID2, nameAr: "برنامج", nameEn: "Program", descriptionAr: "",
  descriptionEn: "", daysCount: 5, hoursPerDay: 2, minParticipants: 3, maxParticipants: 10,
  priceSar: 500, currency: "SAR", depositEnabled: true, depositSar: 100, isPublic: true,
  publicDescriptionAr: "", publicDescriptionEn: "", supervisorIds: [ID],
}
const slot = { dayOfWeek: 0, startTime: "09:00", endTime: "17:00", isActive: true }
const intro = {
  tag: "وسم", titlePrefix: "بداية", titleHighlight: "مميّز", titleSuffix: "", subtitle: "وصف",
}
const category = {
  nameAr: "عيادة", nameEn: "Clinic", sortOrder: 1, departmentId: ID, bookingMode: "DIRECT",
  kind: "CLINIC", iconName: "heart", iconBgColor: "#ffffff", imageUrl: null,
}
const serviceForm = {
  nameEn: "Session", nameAr: "جلسة", descriptionEn: "", descriptionAr: "", categoryId: ID,
  isActive: true, isHidden: false, hidePriceOnBooking: false, hideDurationOnBooking: false,
  iconName: null, iconBgColor: "#AABBCC", imageUrl: null, bufferMinutes: 10,
  bufferBeforeMinutes: 5, bufferAfterMinutes: null, depositEnabled: true, depositAmount: 50,
  minLeadMinutes: 60, maxAdvanceDays: 30, branchIds: [ID], calendarColor: "#112233",
}
const supportGroup = {
  slug: "group-1", name: "مجموعة", nameEn: "Group", desc: "وصف", descEn: "Description",
  image: "/group.png", participants: "8", sessions: "6", format: "حضوري",
}
const userBase = { email: "staff@example.com", name: "موظف", phone: "+966501234567", gender: "MALE" }

/** One realistic, accepted value per schema (asserted by the spec). */
export const valid: Record<string, unknown> = {
  "authLogin.identifierSchema": "staff@example.com",
  "authLogin.otpCodeSchema": "123456",
  "blogPosts.blogPostSchema": blogPost,
  "blogPosts.blogPostsSchema": { posts: [blogPost] },
  "booking.bookingCreateSchema": bookingCreate,
  "booking.createBookingCreateSchema": bookingCreate,
  "booking.bookingPosPayloadSchema": {
    clientId: ID, employeeId: ID2, serviceId: ID, type: "individual", deliveryType: "IN_PERSON",
    durationOptionId: "opt-1", date: "2026-12-01", startTime: "10:00", payAtClinic: true,
    branchId: ID2, couponCode: "SAVE10",
  },
  "booking.createRescheduleBookingSchema": reschedule,
  "booking.rescheduleBookingSchema": reschedule,
  "booking.createWalkInClientSchema": person,
  "booking.walkInClientSchema": person,
  "branch.branchSchema": {
    nameAr: "الفرع الرئيسي", nameEn: "Main branch", address: "الرياض", phone: "+966501234567",
    isMain: true, isActive: true, timezone: "Asia/Riyadh",
  },
  "change-password-dialog:buildSchema": {
    currentPassword: "OldPass123", newPassword: "NewPass123", confirmPassword: "NewPass123",
  },
  "client.createClientSchema": person,
  "client.createClientSchemaWithI18n": person,
  "client.editClientSchema": { ...person, isActive: true },
  "coupon.couponSchema": {
    code: "SAVE10", descriptionEn: "Ten off", descriptionAr: "خصم", discountType: "PERCENTAGE",
    discountValue: 10, minOrderAmt: 100, maxUses: 50, maxUsesPerUser: 1, serviceIds: [ID],
    expiresAt: "2026-12-31", isActive: true,
  },
  "department.departmentSchema": {
    nameAr: "قسم", nameEn: "Department", descriptionAr: "وصف", descriptionEn: "Description",
    icon: "heart", sortOrder: 1, isActive: true, isVisible: true,
  },
  "draftService.addServiceSchema": employeeService,
  "employee.assignServiceSchema": employeeService,
  "employee.editEmployeeServiceSchema": { bufferMinutes: 10, isActive: true },
  "employee.createEmployeeEmailSchema()": "sara@example.com",
  "employee.createEmployeeEmailSchema(t)": "sara@example.com",
  "employeeCreate.createEmployeeSchema()": employeeForm,
  "employeeCreate.createEmployeeSchema(t)": employeeForm,
  "employeeCreate.createEmployeeSchemaStatic": employeeForm,
  "faq.faqItemSchema": faqItem,
  "faq.faqItemsSchema": { items: [faqItem] },
  "featureCards.featureCardsSchema": { cards: [featureCard, featureCard, featureCard] },
  "forgot-password-form:emailSchema": "staff@example.com",
  "hero.heroFormSchema": heroForm,
  "login/combined-step:passwordSchema": "Passw0rd",
  "packageGroups.groupedDiscountFormSchema": { type: "PERCENTAGE", value: 10 },
  "packageGroups.groupedGroupFormSchema": groupedGroup,
  "packageGroups.groupedPackageSchema": groupedPackage,
  "packageGroups.groupedSessionFormSchema": groupedSession,
  "payment.addCreditSchema": { amount: 50, note: "ملاحظة" },
  "payment.verifyTransferSchema": { action: "approve", transferRef: "REF-1" },
  "pkg.createPackageSchema": packageForm,
  "pkg.editPackageSchema": packageForm,
  "pkg.packageItemSchema": flexibleItem,
  "pkg.scopeSchema": { mode: "INCLUDE", ids: [ID] },
  "program.buildCancelProgramSchema": { reason: "سبب الإلغاء" },
  "program.cancelProgramSchema": { reason: "سبب الإلغاء" },
  "program.buildCreateProgramSchema": programForm,
  "program.createProgramSchema": programForm,
  "program.buildEnrollInProgramSchema": { clientId: ID },
  "program.enrollInProgramSchema": { clientId: ID },
  "program.buildScheduleProgramSchema": { startDate: "2026-12-01" },
  "program.scheduleProgramSchema": { startDate: "2026-12-01" },
  "program.halalasField": 15000,
  "reset-password-form:strongPasswordSchema": "Passw0rd",
  "scheduleEditor.scheduleSchema": {
    schedule: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ ...slot, dayOfWeek })),
  },
  "scheduleEditor.slotSchema": slot,
  "sectionIntros.sectionIntrosSchema": {
    features: intro, clinics: intro, supportGroups: intro, team: intro, testimonials: intro,
    blog: intro, faq: intro, cta: intro,
  },
  "service.createCategorySchema": category,
  "service.editCategorySchema": { ...category, isActive: true },
  "serviceCreate.createServiceEditSchema()": serviceForm,
  "serviceCreate.createServiceEditSchema(saved)": serviceForm,
  "serviceCreate.createServiceSchema": serviceForm,
  "supportGroups.supportGroupItemSchema": supportGroup,
  "supportGroups.supportGroupsSchema": { groups: [supportGroup] },
  "user.createRoleSchema": { name: "مشرف" },
  "user.userBaseSchema": userBase,
  "user.userCreateSchema": { ...userBase, password: "Passw0rd!", roleSelection: "ADMIN" },
  "user.userEditSchema": { ...userBase, roleSelection: "custom:role-1" },
}

/* ─── Cross-field scenarios ─── */

/** Returns the valid state with `patch` applied at dotted paths. */
type Scenario = Record<string, unknown>

const programScenarios: Record<string, Scenario> = {
  "min participants above max": { minParticipants: 20 },
  "deposit above price": { depositSar: 600 },
  "deposit enabled without amount": { depositSar: undefined },
  "deposit disabled without amount": { depositEnabled: false, depositSar: undefined },
  "both cross-field rules broken": { minParticipants: 20, depositSar: 600 },
  "no supervisors": { supervisorIds: [] },
  "defaults omitted": { currency: undefined, depositEnabled: undefined, isPublic: undefined },
}
const personScenarios: Record<string, Scenario> = {
  "empty optional fields": {
    gender: undefined, dateOfBirth: "", nationality: "", nationalId: "", emergencyName: "",
    emergencyPhone: "", bloodType: undefined, allergies: "", chronicConditions: "",
  },
  "bad emergency phone": { emergencyPhone: "12345" },
  "name with spaces": { fullName: "  سارة  " },
}
const employeeScenarios: Record<string, Scenario> = {
  "empty selects": { gender: "", employmentType: "" },
  "empty optional fields": {
    title: "", phone: "", specialtyAr: "", bio: "", bioAr: "", experience: undefined,
    education: "", educationAr: "", avatarUrl: "", avatarFile: undefined, branchIds: [],
    serviceIds: [],
  },
  "experience typed as text": { experience: "7" },
  "empty experience input": { experience: "" },
}
const serviceScenarios: Record<string, Scenario> = {
  "no category": { categoryId: "" },
  "no english name": { nameEn: "" },
  "empty number inputs": {
    bufferMinutes: "", bufferBeforeMinutes: "", bufferAfterMinutes: "", depositAmount: "",
    minLeadMinutes: "", maxAdvanceDays: "",
  },
  "cleared number inputs": {
    bufferMinutes: undefined, bufferBeforeMinutes: null, bufferAfterMinutes: null,
    depositAmount: null, minLeadMinutes: null, maxAdvanceDays: null,
  },
  "numbers typed as text": { bufferMinutes: "15", depositAmount: "49.5", maxAdvanceDays: "90" },
  "out of range": { bufferMinutes: 121, minLeadMinutes: 1441, maxAdvanceDays: 366 },
  "bad colours": { iconBgColor: "red", calendarColor: "#12345" },
}
const categoryScenarios: Record<string, Scenario> = {
  "no department": { departmentId: "" },
  "empty sort order input": { sortOrder: Number.NaN },
  "blank sort order": { sortOrder: "" },
  "null sort order": { sortOrder: null },
  "sort order typed as text": { sortOrder: "7" },
  "sort order out of range": { sortOrder: 1000 },
  "empty english name": { nameEn: "" },
  "defaults omitted": { bookingMode: undefined, kind: undefined },
}
const packageItemScenarios: Record<string, Scenario> = {
  "no sessions at all": { paidQuantity: 0, freeQuantity: 0 },
  "free sessions only": { paidQuantity: 0, freeQuantity: 2 },
  "ANY scope with targets": { "practitioner.ids": [ID] },
  "INCLUDE scope without targets": { "service.ids": [] },
  "duration without single service": { "duration.mode": "INCLUDE", "duration.ids": ["opt-1"], "service.mode": "ANY", "service.ids": [] },
  "flexible without price": { unitPriceSar: undefined },
  "flexible with empty price input": { unitPriceSar: Number.NaN },
  "flexible with zero price": { unitPriceSar: 0 },
  "percentage above 100": { discountValue: 150 },
  "fixed discount above payable": { discountType: "FIXED", discountValue: 10000 },
  "no discount": { discountType: null, discountValue: undefined },
  "quantities typed as text": { paidQuantity: "4", freeQuantity: "1", unitPriceSar: "200" },
  "empty quantity inputs": { paidQuantity: "", freeQuantity: "" },
  "legacy item without selection mode": { selectionMode: undefined },
}
const packageScenarios: Record<string, Scenario> = {
  "no items": { items: [] },
  "items omitted": { items: undefined },
  "no arabic name": { nameAr: "" },
  "arabic name omitted": { nameAr: undefined },
  "blank arabic name": { nameAr: "   " },
  "first item has no sessions": { "items.0.paidQuantity": 0, "items.0.freeQuantity": 0 },
  "first item flexible without price": { "items.0.unitPriceSar": undefined },
  "second item duration without service": { "items.1.service.mode": "ANY", "items.1.service.ids": [] },
  "no owner": { ownerEmployeeId: null },
  "empty sort order input": { sortOrder: "" },
}
const groupedScenarios: Record<string, Scenario> = {
  "duplicate group keys": { "groups.1.key": "g1", "groups.1.dependsOnGroupKey": null },
  "group without service": { "groups.0.serviceId": "" },
  "group without employee": { "groups.1.employeeId": "" },
  "depends on unknown group": { "groups.1.dependsOnGroupKey": "missing" },
  "depends on itself": { "groups.1.dependsOnGroupKey": "g2" },
  "dependency cycle": { "groups.0.dependsOnGroupKey": "g2" },
  "blank dependency": { "groups.1.dependsOnGroupKey": "   " },
  "percentage above 100": { "globalDiscount.value": 150 },
  "fixed discount above subtotal": { "globalDiscount.type": "FIXED", "globalDiscount.value": 100000 },
  "fixed discount within subtotal": { "globalDiscount.type": "FIXED", "globalDiscount.value": 100 },
  "discount with three decimals": { "globalDiscount.value": 10.123 },
  "no discount": { "globalDiscount.type": "NONE", "globalDiscount.value": 0 },
  "session price with three decimals": { "groups.0.sessions.0.unitPriceSar": 150.125 },
  "group without sessions": { "groups.0.sessions": [] },
  "no groups": { groups: [] },
  "prices typed as text": { "groups.0.sessions.0.unitPriceSar": "150.50", "globalDiscount.value": "10", sortOrder: "2" },
  "empty price input": { "groups.0.sessions.0.unitPriceSar": "" },
}
const userScenarios: Record<string, Scenario> = {
  "empty gender": { gender: "" },
  "null gender": { gender: null },
  "no phone": { phone: "" },
  "local phone": { phone: "0501234567" },
}

export const scenarios: Record<string, Record<string, Scenario>> = {
  "change-password-dialog:buildSchema": {
    "confirmation mismatch": { confirmPassword: "Different1" },
    "weak new password": { newPassword: "weak", confirmPassword: "weak" },
    "no uppercase": { newPassword: "newpass123", confirmPassword: "newpass123" },
  },
  "coupon.couponSchema": {
    "percentage above 100": { discountValue: 150 },
    "fixed above 100": { discountType: "FIXED", discountValue: 150 },
    "empty optional numbers": { minOrderAmt: "", maxUses: "", maxUsesPerUser: "" },
    "optional numbers omitted": { minOrderAmt: undefined, maxUses: undefined, maxUsesPerUser: undefined },
    "numbers typed as text": { discountValue: "12.5", minOrderAmt: "100", maxUses: "5" },
    "empty discount input": { discountValue: "" },
    "lowercase code": { code: "save_10-x" },
  },
  "department.departmentSchema": {
    "names padded with spaces": { nameAr: "  قسم  ", nameEn: "  Department  " },
    "blank names": { nameAr: "   ", nameEn: "   " },
    "empty optional text": { descriptionAr: "", descriptionEn: "", icon: "" },
  },
  "payment.verifyTransferSchema": {
    "no action": { action: undefined },
    "null action": { action: null },
    "unknown action": { action: "hold" },
  },
  "payment.addCreditSchema": {
    "amount typed as text": { amount: "49.5" },
    "empty amount input": { amount: "" },
    "zero amount": { amount: 0 },
  },
  "employee.assignServiceSchema": { "empty buffer input": { bufferMinutes: "" }, "buffer typed as text": { bufferMinutes: "15" } },
  "draftService.addServiceSchema": { "empty buffer input": { bufferMinutes: "" }, "no service": { serviceId: "" } },
  "featureCards.featureCardsSchema": {
    "unknown icon": { "cards.1.icon": "NotAnIcon" },
    "two cards": { cards: [featureCard, featureCard] },
    "four cards": { cards: [featureCard, featureCard, featureCard, featureCard] },
  },
  "scheduleEditor.scheduleSchema": {
    "six days": { schedule: [0, 1, 2, 3, 4, 5].map((dayOfWeek) => ({ ...slot, dayOfWeek })) },
    "eight days": { schedule: [0, 1, 2, 3, 4, 5, 6, 0].map((dayOfWeek) => ({ ...slot, dayOfWeek })) },
    "bad time": { "schedule.2.startTime": "9:00" },
    "six days with a bad time": {
      schedule: [0, 1, 2, 3, 4, 5].map((dayOfWeek) => ({ ...slot, dayOfWeek, startTime: dayOfWeek === 1 ? "9" : "09:00" })),
    },
  },
  "blogPosts.blogPostsSchema": { "no posts": { posts: [] }, "no author": { "posts.0.author": null } },
  "faq.faqItemsSchema": { "no items": { items: [] } },
  "supportGroups.supportGroupsSchema": { "no groups": { groups: [] } },
  "booking.createWalkInClientSchema": personScenarios,
  "booking.walkInClientSchema": personScenarios,
  "client.createClientSchema": personScenarios,
  "client.createClientSchemaWithI18n": personScenarios,
  "client.editClientSchema": { ...personScenarios, "no phone": { phone: "" } },
  "employeeCreate.createEmployeeSchema()": employeeScenarios,
  "employeeCreate.createEmployeeSchema(t)": employeeScenarios,
  "employeeCreate.createEmployeeSchemaStatic": employeeScenarios,
  "packageGroups.groupedPackageSchema": groupedScenarios,
  "packageGroups.groupedSessionFormSchema": {
    "price with three decimals": { unitPriceSar: 150.125 },
    "price typed as text": { unitPriceSar: "150.50" },
    "empty price input": { unitPriceSar: "" },
  },
  "pkg.packageItemSchema": packageItemScenarios,
  "pkg.createPackageSchema": packageScenarios,
  "pkg.editPackageSchema": packageScenarios,
  "program.buildCreateProgramSchema": programScenarios,
  "program.createProgramSchema": programScenarios,
  "service.createCategorySchema": categoryScenarios,
  "service.editCategorySchema": categoryScenarios,
  "serviceCreate.createServiceEditSchema()": serviceScenarios,
  "serviceCreate.createServiceEditSchema(saved)": serviceScenarios,
  "serviceCreate.createServiceSchema": serviceScenarios,
  "user.userBaseSchema": userScenarios,
  "user.userCreateSchema": { ...userScenarios, "short password": { password: "short" }, "no role": { roleSelection: "" } },
  "user.userEditSchema": { ...userScenarios, "role omitted": { roleSelection: undefined } },
  "user.createRoleSchema": { "unknown extra key": { extra: 1 }, "padded name": { name: "  مشرف  " } },
}

export type { Obj }
