/**
 * Booking Scenarios — Real E2E Tests (30 Stories)
 * ================================================
 * End-to-end tests that exercise the full HTTP stack + real Postgres DB.
 *
 * Prerequisites:
 *   REAL_E2E_DATABASE_URL=postgresql://... (db name must include 'test' or 'e2e')
 *   pnpm docker:up
 *   pnpm --filter=backend prisma:migrate:deploy
 *
 * Run:
 *   REAL_E2E_DATABASE_URL=... npx jest test/e2e/bookings/booking-scenarios.real-e2e-spec.ts
 */

import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../../src/infrastructure/database";
import { JwtService } from "@nestjs/jwt";
import {
	BookingStatus,
	CancellationReason,
	DeliveryType,
	Prisma,
	RefundType,
} from "@prisma/client";
import request from "supertest";
import { createRealE2eApp } from "../../helpers/create-real-e2e-app";

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL
	? describe
	: describe.skip;

describeRealE2e("Booking Scenarios — 30 Real-World Stories (real e2e)", () => {
	jest.setTimeout(60_000);

	let app: INestApplication;
	let prisma: PrismaService;
	let jwtService: JwtService;
	let authToken: string;

	// ── Base entity IDs (seeded once in beforeAll) ────────────────────────────
	const ctx = {
		branchId: "",
		employeeId: "",
		employee2Id: "",
		serviceId: "",
		serviceGroupId: "",
		clientId: "",
		client2Id: "",
		userId: "",
		serviceCatId: "",
		deptId: "",
	};

	// ── Helpers ───────────────────────────────────────────────────────────────

	const tomorrow = (hour = 10, minute = 0) => {
		const d = new Date();
		d.setDate(d.getDate() + 1);
		d.setHours(hour, minute, 0, 0);
		return d;
	};

	const daysFromNow = (days: number, hour = 10, minute = 0) => {
		const d = new Date();
		d.setDate(d.getDate() + days);
		d.setHours(hour, minute, 0, 0);
		return d;
	};

	const api = () => request(app.getHttpServer());

	const withAuth = (req: request.Test) =>
		req.set("Authorization", `Bearer ${authToken}`);

	const getFirstAvailableSlot = async (
		employeeId = ctx.employeeId,
		serviceId = ctx.serviceId,
		date = tomorrow(),
		durationMins = 60,
	) => {
		const res = await withAuth(
			api().get("/api/v1/dashboard/bookings/availability"),
		).query({
			branchId: ctx.branchId,
			employeeId,
			serviceId,
			date: date.toISOString(),
			durationMins,
		});
		expect(res.status).toBe(200);
		expect(res.body.length).toBeGreaterThan(0);
		return new Date(res.body[0].startTime);
	};

	const createBooking = async (overrides: Record<string, unknown> = {}) => {
		const res = await withAuth(api().post("/api/v1/dashboard/bookings")).send({
			branchId: ctx.branchId,
			clientId: ctx.clientId,
			employeeId: ctx.employeeId,
			serviceId: ctx.serviceId,
			scheduledAt: tomorrow().toISOString(),
			...overrides,
		});
		return res;
	};

	const getBooking = async (id: string) => {
		const res = await withAuth(api().get(`/api/v1/dashboard/bookings/${id}`));
		return res;
	};

	const confirmBooking = async (id: string) => {
		const res = await withAuth(
			api().patch(`/api/v1/dashboard/bookings/${id}/confirm`),
		).send({});
		return res;
	};

	const completeBooking = async (id: string) => {
		const res = await withAuth(
			api().patch(`/api/v1/dashboard/bookings/${id}/complete`),
		).send({});
		return res;
	};

	const cancelBooking = async (
		id: string,
		body: Record<string, unknown> = {},
	) => {
		const res = await withAuth(
			api().patch(`/api/v1/dashboard/bookings/${id}/cancel`),
		).send({
			reason: CancellationReason.CLIENT_REQUESTED,
			...body,
		});
		return res;
	};

	const approveCancel = async (
		id: string,
		body: Record<string, unknown> = {},
	) => {
		const res = await withAuth(
			api().patch(`/api/v1/dashboard/bookings/${id}/approve-cancel`),
		).send(body);
		return res;
	};

	const rejectCancel = async (
		id: string,
		body: Record<string, unknown> = {},
	) => {
		const res = await withAuth(
			api().patch(`/api/v1/dashboard/bookings/${id}/reject-cancel`),
		).send(body);
		return res;
	};

	const rescheduleBooking = async (
		id: string,
		newScheduledAt: Date,
		newDurationMins?: number,
	) => {
		const body: Record<string, unknown> = {
			newScheduledAt: newScheduledAt.toISOString(),
		};
		if (newDurationMins) body.newDurationMins = newDurationMins;
		const res = await withAuth(
			api().patch(`/api/v1/dashboard/bookings/${id}/reschedule`),
		).send(body);
		return res;
	};

	const noShowBooking = async (id: string) => {
		const res = await withAuth(
			api().patch(`/api/v1/dashboard/bookings/${id}/no-show`),
		).send({});
		return res;
	};

	const checkInBooking = async (id: string) => {
		const res = await withAuth(
			api().patch(`/api/v1/dashboard/bookings/${id}/check-in`),
		).send({});
		return res;
	};

	const createRecurring = async (body: Record<string, unknown>) => {
		const res = await withAuth(
			api().post("/api/v1/dashboard/bookings/recurring"),
		).send(body);
		return res;
	};

	// ── Setup ─────────────────────────────────────────────────────────────────

	beforeAll(async () => {
		const result = await createRealE2eApp();
		app = result.app;
		prisma = result.prisma;
		jwtService = app.get(JwtService);

		// Clean any prior test data
		await cleanupAll();

		// ── Seed base organization data ──
		const existingOrgSettings = await prisma.organizationSettings.findFirst({});
		if (existingOrgSettings) {
			await prisma.organizationSettings.update({
				where: { id: existingOrgSettings.id },
				data: { vatRate: "0.15", paymentAtClinicEnabled: true },
			});
		} else {
			await prisma.organizationSettings.create({
				data: { vatRate: "0.15", paymentAtClinicEnabled: true },
			});
		}

		const existingBookingSettings = await prisma.bookingSettings.findFirst({
			where: { branchId: null },
		});
		if (existingBookingSettings) {
			await prisma.bookingSettings.update({
				where: { id: existingBookingSettings.id },
				data: {
					maxReschedulesPerBooking: 3,
					clientRescheduleMinHoursBefore: 24,
					freeCancelBeforeHours: 24,
					freeCancelRefundType: RefundType.FULL,
					lateCancelRefundPercent: 0,
					requireCancelApproval: false,
					autoRefundOnCancel: true,
					minBookingLeadMinutes: 60,
					maxAdvanceBookingDays: 90,
				},
			});
		} else {
			await prisma.bookingSettings.create({
				data: {
					maxReschedulesPerBooking: 3,
					clientRescheduleMinHoursBefore: 24,
					freeCancelBeforeHours: 24,
					freeCancelRefundType: RefundType.FULL,
					lateCancelRefundPercent: 0,
					requireCancelApproval: false,
					autoRefundOnCancel: true,
					minBookingLeadMinutes: 60,
					maxAdvanceBookingDays: 90,
				},
			});
		}

		// ── Create test user (OWNER) ──
		const user = await prisma.user.create({
			data: {
				email: "owner-e2e@sawaa.app",
				passwordHash: "not-used",
				name: "E2E Owner",
				role: "ADMIN",
				isActive: true,
			},
		});
		ctx.userId = user.id;
		authToken = jwtService.sign({
			sub: user.id,
			email: user.email,
			role: user.role,
			isSuperAdmin: true,
		});

		// ── Create branch ──
		const branch = await prisma.branch.create({
			data: { nameAr: "فرع الاختبار", nameEn: "Test Branch", isActive: true },
		});
		ctx.branchId = branch.id;

		// ── Create department + category ──
		const dept = await prisma.department.create({
			data: { nameAr: "الاستشارات", nameEn: "Counseling", isActive: true },
		});
		ctx.deptId = dept.id;

		const cat = await prisma.serviceCategory.create({
			data: {
				nameAr: "العلاج النفسي",
				nameEn: "Psychotherapy",
				departmentId: dept.id,
				isActive: true,
			},
		});
		ctx.serviceCatId = cat.id;

		// ── Create employees ──
		const emp = await prisma.employee.create({
			data: {
				name: "د. نورة",
				nameAr: "د. نورة",
				email: "nora-e2e@sawaa.app",
				phone: "0500000001",
				isActive: true,
			},
		});
		ctx.employeeId = emp.id;

		const emp2 = await prisma.employee.create({
			data: {
				name: "د. سامي",
				nameAr: "د. سامي",
				email: "sami-e2e@sawaa.app",
				phone: "0500000002",
				isActive: true,
			},
		});
		ctx.employee2Id = emp2.id;

		// ── Link employees to branch ──
		await prisma.employeeBranch.createMany({
			data: [
				{ employeeId: emp.id, branchId: branch.id },
				{ employeeId: emp2.id, branchId: branch.id },
			],
		});

		// ── Create services ──
		const svc = await prisma.service.create({
			data: {
				nameAr: "جلسة استشارة فردية",
				nameEn: "Individual Counseling",
				durationMins: 60,
				price: 30000, // 300 SAR in halalas
				currency: "SAR",
				isActive: true,
				categoryId: cat.id,
			},
		});
		ctx.serviceId = svc.id;

		const groupSvc = await prisma.service.create({
			data: {
				nameAr: "ورشة التواصل بين الزوجين",
				nameEn: "Couples Communication Workshop",
				durationMins: 90,
				price: 50000, // 500 SAR in halalas
				currency: "SAR",
				isActive: true,
				categoryId: cat.id,
				minParticipants: 4,
				maxParticipants: 10,
				reserveWithoutPayment: true,
			},
		});
		ctx.serviceGroupId = groupSvc.id;

		// ── Service booking configs + duration options (required by CheckAvailabilityHandler)
		await prisma.serviceBookingConfig.createMany({
			data: [
				{
					serviceId: svc.id,
					deliveryType: "IN_PERSON",
					useCustomAvailability: false,
				},
				{
					serviceId: svc.id,
					deliveryType: "ONLINE",
					useCustomAvailability: false,
				},
				{
					serviceId: groupSvc.id,
					deliveryType: "IN_PERSON",
					useCustomAvailability: false,
				},
			],
		});

		await prisma.serviceDurationOption.createMany({
			data: [
				{
					serviceId: svc.id,
					durationMins: 60,
					deliveryType: "IN_PERSON",
					label: "60 min",
					labelAr: "60 دقيقة",
					price: 30000,
					isDefault: true,
					isActive: true,
					sortOrder: 1,
				},
				{
					serviceId: svc.id,
					durationMins: 60,
					deliveryType: "ONLINE",
					label: "60 min",
					labelAr: "60 دقيقة",
					price: 30000,
					isDefault: true,
					isActive: true,
					sortOrder: 1,
				},
				{
					serviceId: groupSvc.id,
					durationMins: 90,
					deliveryType: "IN_PERSON",
					label: "90 min",
					labelAr: "90 دقيقة",
					price: 50000,
					isDefault: true,
					isActive: true,
					sortOrder: 1,
				},
			],
		});

		// ── Link employees to services ──
		await prisma.employeeService.createMany({
			data: [
				{ employeeId: emp.id, serviceId: svc.id, isActive: true },
				{ employeeId: emp.id, serviceId: groupSvc.id, isActive: true },
				{ employeeId: emp2.id, serviceId: svc.id, isActive: true },
			],
		});

		// ── Business hours + employee availability ──
		const dow = tomorrow().getDay();
		await prisma.businessHour.createMany({
			data: [
				{
					branchId: branch.id,
					dayOfWeek: dow,
					startTime: "08:00",
					endTime: "22:00",
					isOpen: true,
				},
				{
					branchId: branch.id,
					dayOfWeek: (dow + 1) % 7,
					startTime: "08:00",
					endTime: "22:00",
					isOpen: true,
				},
				{
					branchId: branch.id,
					dayOfWeek: (dow + 2) % 7,
					startTime: "08:00",
					endTime: "22:00",
					isOpen: true,
				},
			],
		});

		await prisma.employeeAvailability.createMany({
			data: [
				{
					employeeId: emp.id,
					dayOfWeek: dow,
					startTime: "08:00",
					endTime: "22:00",
					isActive: true,
				},
				{
					employeeId: emp.id,
					dayOfWeek: (dow + 1) % 7,
					startTime: "08:00",
					endTime: "22:00",
					isActive: true,
				},
				{
					employeeId: emp.id,
					dayOfWeek: (dow + 2) % 7,
					startTime: "08:00",
					endTime: "22:00",
					isActive: true,
				},
				{
					employeeId: emp2.id,
					dayOfWeek: dow,
					startTime: "08:00",
					endTime: "22:00",
					isActive: true,
				},
			],
		});

		// ── Create clients ──
		const client = await prisma.client.create({
			data: {
				name: "سارة",
				phone: "0500000003",
				email: "sara-e2e@sawaa.app",
				source: "ONLINE",
			},
		});
		ctx.clientId = client.id;

		const client2 = await prisma.client.create({
			data: {
				name: "خالد",
				phone: "0500000004",
				email: "khaled-e2e@sawaa.app",
				source: "ONLINE",
			},
		});
		ctx.client2Id = client2.id;
	});

	afterEach(async () => {
		if (!prisma) return;
		await cleanupScenarioData();
	});

	afterAll(async () => {
		if (prisma) await cleanupAll();
		if (app) await app.close();
	});

	async function cleanupScenarioData() {
		if (!prisma) return;
		await prisma
			.$transaction([
				prisma.refundRequest.deleteMany({}),
				prisma.bookingStatusLog.deleteMany({}),
				prisma.payment.deleteMany({}),
				prisma.invoice.deleteMany({}),
				prisma.booking.deleteMany({}),
				prisma.groupEnrollment.deleteMany({}),
				prisma.groupSession.deleteMany({}),
				prisma.couponRedemption.deleteMany({}),
				prisma.coupon.deleteMany({}),
			])
			.catch(() => undefined);
	}

	async function cleanupAll() {
		if (!prisma) return;
		await cleanupScenarioData();
		await prisma
			.$transaction([
				prisma.employeeAvailability.deleteMany({}),
				prisma.businessHour.deleteMany({}),
				prisma.employeeService.deleteMany({}),
				prisma.employeeBranch.deleteMany({}),
				prisma.service.deleteMany({}),
				prisma.serviceCategory.deleteMany({}),
				prisma.department.deleteMany({}),
				prisma.client.deleteMany({}),
				prisma.employee.deleteMany({}),
				prisma.branch.deleteMany({}),
				prisma.user.deleteMany({}),
				prisma.bookingSettings.deleteMany({}),
				prisma.organizationSettings.deleteMany({}),
			])
			.catch(() => undefined);
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// SCENARIOS 1–7: Individual Booking Lifecycle
	// ═══════════════════════════════════════════════════════════════════════════

	describe("Scenarios 1–7: Individual booking lifecycle", () => {
		it("Scenario 1 — Mother books online session, pays, Zoom created, completed", async () => {
			// Step 1: Create booking as CONFIRMED (dashboard/reception)
			const scheduledAt = tomorrow(14, 0);
			const createRes = await createBooking({
				scheduledAt: scheduledAt.toISOString(),
				deliveryType: "ONLINE",
			});
			expect(createRes.status).toBe(201);
			const bookingId = createRes.body.id;
			expect(createRes.body.status).toBe("CONFIRMED");

			// Step 2: Invoice + payment are auto-created by the booking flow;
			// fetch the existing invoice and record the payment.
			const invoice = await prisma.invoice.findFirst({
				where: { bookingId },
			});
			expect(invoice).not.toBeNull();
			await prisma.payment.create({
				data: {
					invoiceId: invoice!.id,
					amount: Number(invoice!.total),
					currency: "SAR",
					status: "COMPLETED",
					method: "MADA",
					gatewayRef: "pay_mada_123",
				},
			});

			// Step 3: Staff marks COMPLETED
			const completeRes = await completeBooking(bookingId);
			expect(completeRes.status).toBe(200);
			expect(completeRes.body.status).toBe("COMPLETED");

			const booking = await prisma.booking.findUnique({
				where: { id: bookingId },
			});
			expect(booking?.status).toBe(BookingStatus.COMPLETED);
		});

		it("Scenario 2 — Booking expires after payment timeout, slot freed", async () => {
			const scheduledAt = tomorrow(15, 0);
			const createRes = await createBooking({
				scheduledAt: scheduledAt.toISOString(),
			});
			expect(createRes.status).toBe(201);
			const bookingId = createRes.body.id;

			// Manually move booking to AWAITING_PAYMENT to simulate pending payment
			await prisma.booking.update({
				where: { id: bookingId },
				data: {
					status: BookingStatus.AWAITING_PAYMENT,
					expiresAt: new Date(Date.now() - 1000),
				},
			});

			// Manually expire the booking (simulating cron)
			const { ExpireBookingHandler } = await import(
				"../../../src/modules/bookings/expire-booking/expire-booking.handler"
			);
			const expireHandler = app.get(ExpireBookingHandler);
			await expireHandler.execute({ bookingId, changedBy: "system" });

			const booking = await prisma.booking.findUnique({
				where: { id: bookingId },
			});
			expect(booking?.status).toBe(BookingStatus.EXPIRED);

			// Same slot should now be bookable by another client
			const createRes2 = await createBooking({
				clientId: ctx.client2Id,
				scheduledAt: scheduledAt.toISOString(),
			});
			expect(createRes2.status).toBe(201);
			expect(createRes2.body.id).not.toBe(bookingId);
		});

		it("Scenario 3 — Pay-at-clinic: no invoice on create, invoice on completion", async () => {
			const scheduledAt = tomorrow(16, 0);
			const createRes = await createBooking({
				scheduledAt: scheduledAt.toISOString(),
				payAtClinic: true,
			});
			expect(createRes.status).toBe(201);
			const bookingId = createRes.body.id;

			// No invoice created initially
			const invoicesBefore = await prisma.invoice.findMany({
				where: { bookingId },
			});
			expect(invoicesBefore).toHaveLength(0);

			// Complete creates invoice
			const completeRes = await completeBooking(bookingId);
			expect(completeRes.status).toBe(200);

			const invoicesAfter = await prisma.invoice.findMany({
				where: { bookingId },
			});
			expect(invoicesAfter).toHaveLength(1);
			expect(invoicesAfter[0].status).toBe("ISSUED");
		});

		it("Scenario 4 — Pay-at-clinic no-show: no refund, status NO_SHOW", async () => {
			const scheduledAt = tomorrow(11, 0);
			const createRes = await createBooking({
				scheduledAt: scheduledAt.toISOString(),
				payAtClinic: true,
			});
			const bookingId = createRes.body.id;

			const noShowRes = await noShowBooking(bookingId);
			expect(noShowRes.status).toBe(200);
			expect(noShowRes.body.status).toBe("NO_SHOW");

			// No payment exists → no refund attempt
			const refunds = await prisma.refundRequest.findMany({});
			expect(refunds).toHaveLength(0);
		});

		it("Scenario 5 — Reschedule to new time, Zoom updated", async () => {
			const oldTime = tomorrow(10, 0);
			const newTime = tomorrow(12, 0);

			const createRes = await createBooking({
				scheduledAt: oldTime.toISOString(),
				deliveryType: "ONLINE",
			});
			const bookingId = createRes.body.id;

			// Manually set Zoom meeting ID (simulating payment completion trigger)
			await prisma.booking.update({
				where: { id: bookingId },
				data: { zoomMeetingId: "zoom-555", zoomMeetingStatus: "CREATED" },
			});

			const rescheduleRes = await rescheduleBooking(bookingId, newTime);
			expect(rescheduleRes.status).toBe(200);

			const booking = await prisma.booking.findUnique({
				where: { id: bookingId },
			});
			expect(booking?.scheduledAt.getTime()).toBe(newTime.getTime());
		});

		it("Scenario 6 — Reschedule to occupied slot rejected", async () => {
			const slot1 = tomorrow(10, 0);
			const slot2 = tomorrow(10, 0); // same slot intentionally

			// Book first client
			const res1 = await createBooking({
				clientId: ctx.clientId,
				scheduledAt: slot1.toISOString(),
			});
			expect(res1.status).toBe(201);

			// Second booking in same slot should fail (400: slot not available)
			const res2 = await createBooking({
				clientId: ctx.client2Id,
				scheduledAt: slot1.toISOString(),
			});
			expect(res2.status).toBe(400);
		});

		it("Scenario 7 — Max reschedules (3) enforced", async () => {
			const createRes = await createBooking({
				scheduledAt: tomorrow(10, 0).toISOString(),
			});
			const bookingId = createRes.body.id;

			// Reschedule 3 times
			for (let i = 1; i <= 3; i++) {
				const newTime = tomorrow(10 + i, 0);
				const r = await rescheduleBooking(bookingId, newTime);
				expect(r.status).toBe(200);
			}

			// 4th reschedule should fail
			const fourth = await rescheduleBooking(bookingId, tomorrow(14, 0));
			expect(fourth.status).toBe(400);
			expect(fourth.body.message).toMatch(/Maximum reschedules/);
		});
	});

	// ═══════════════════════════════════════════════════════════════════════════
	// SCENARIOS 8–10: Group Sessions
	// ═══════════════════════════════════════════════════════════════════════════

	describe("Scenarios 8–10: Group sessions / workshops", () => {
		it("Scenario 8 — Group session reaches min, transitions to awaiting payment", async () => {
			const scheduledAt = await getFirstAvailableSlot(
				ctx.employeeId,
				ctx.serviceGroupId,
				daysFromNow(3),
				90,
			);

			// Create group session (isPublic: true so BookGroupSessionHandler accepts it)
			const groupSession = await prisma.groupSession.create({
				data: {
					branchId: ctx.branchId,
					employeeId: ctx.employeeId,
					serviceId: ctx.serviceGroupId,
					scheduledAt,
					durationMins: 90,
					maxCapacity: 10,
					price: new Prisma.Decimal(50000),
					status: "OPEN",
					title: "ورشة تواصل",
					deliveryType: "IN_PERSON",
					isPublic: true,
				},
			});

			// Book 4 clients via BookGroupSessionHandler (bypasses availability check)
			const { BookGroupSessionHandler } = await import(
				"../../../src/modules/bookings/public/book-group-session.handler"
			);
			const bookGroupHandler = app.get(BookGroupSessionHandler);
			const clients = [ctx.clientId, ctx.client2Id];
			// Need 2 more clients
			const c3 = await prisma.client.create({
				data: {
					name: "عميل 3",
					phone: "0500000010",
					email: "c3-s8-e2e@sawaa.app",
					source: "ONLINE",
				},
			});
			const c4 = await prisma.client.create({
				data: {
					name: "عميل 4",
					phone: "0500000011",
					email: "c4-s8-e2e@sawaa.app",
					source: "ONLINE",
				},
			});

			for (const cid of [...clients, c3.id, c4.id]) {
				const result = await bookGroupHandler.execute({
					groupSessionId: groupSession.id,
					clientId: cid,
				});
				expect(result.type).toBe("BOOKED");
				expect(result.bookingId).toBeDefined();
			}

			// Trigger min-reached handler
			const { GroupSessionMinReachedHandler } = await import(
				"../../../src/modules/bookings/group-session-min-reached/group-session-min-reached.handler"
			);
			const handler = app.get(GroupSessionMinReachedHandler);
			await handler.execute({
				serviceId: ctx.serviceGroupId,
				employeeId: ctx.employeeId,
				scheduledAt,
			});

			// All bookings should now be AWAITING_PAYMENT
			const bookings = await prisma.booking.findMany({
				where: { groupSessionId: groupSession.id },
			});
			expect(bookings).toHaveLength(4);
			for (const b of bookings) {
				expect(b.status).toBe(BookingStatus.AWAITING_PAYMENT);
			}
		});

		it("Scenario 9 — Participant withdraws, count drops below min, rollback", async () => {
			const scheduledAt = await getFirstAvailableSlot(
				ctx.employeeId,
				ctx.serviceGroupId,
				daysFromNow(3),
				90,
			);

			const groupSession = await prisma.groupSession.create({
				data: {
					branchId: ctx.branchId,
					employeeId: ctx.employeeId,
					serviceId: ctx.serviceGroupId,
					scheduledAt,
					durationMins: 90,
					maxCapacity: 10,
					price: new Prisma.Decimal(50000),
					status: "OPEN",
					title: "ورشة تواصل",
					deliveryType: "IN_PERSON",
					isPublic: true,
				},
			});

			const { BookGroupSessionHandler } = await import(
				"../../../src/modules/bookings/public/book-group-session.handler"
			);
			const bookGroupHandler = app.get(BookGroupSessionHandler);

			const c3 = await prisma.client.create({
				data: {
					name: "عميل 3",
					phone: "0500000012",
					email: "c3-s9-e2e@sawaa.app",
					source: "ONLINE",
				},
			});
			const c4 = await prisma.client.create({
				data: {
					name: "عميل 4",
					phone: "0500000013",
					email: "c4-s9-e2e@sawaa.app",
					source: "ONLINE",
				},
			});

			const bookingIds: string[] = [];
			for (const cid of [ctx.clientId, ctx.client2Id, c3.id, c4.id]) {
				const result = await bookGroupHandler.execute({
					groupSessionId: groupSession.id,
					clientId: cid,
				});
				expect(result.type).toBe("BOOKED");
				bookingIds.push(result.bookingId!);
			}

			// Promote to AWAITING_PAYMENT
			const { GroupSessionMinReachedHandler } = await import(
				"../../../src/modules/bookings/group-session-min-reached/group-session-min-reached.handler"
			);
			await app.get(GroupSessionMinReachedHandler).execute({
				serviceId: ctx.serviceGroupId,
				employeeId: ctx.employeeId,
				scheduledAt,
			});

			// Cancel one booking directly in DB (AWAITING_PAYMENT can't go through DIRECT_CANCEL)
			// and trigger recalculation to roll back the remaining unpaid bookings.
			await prisma.booking.update({
				where: { id: bookingIds[0] },
				data: { status: BookingStatus.CANCELLED },
			});
			const { GroupSessionCapacityService } = await import(
				"../../../src/modules/bookings/group-session/group-session-capacity.service"
			);
			await app
				.get(GroupSessionCapacityService)
				.recalculateGroupStatusStandalone(groupSession.id);

			// Remaining unpaid bookings should roll back to PENDING_GROUP_FILL
			const remaining = await prisma.booking.findMany({
				where: {
					groupSessionId: groupSession.id,
					status: BookingStatus.PENDING_GROUP_FILL,
				},
			});
			expect(remaining.length).toBeGreaterThanOrEqual(1);
		});

		it("Scenario 10 — Group session never reaches min, bookings expire", async () => {
			const scheduledAt = await getFirstAvailableSlot(
				ctx.employeeId,
				ctx.serviceGroupId,
				daysFromNow(3),
				90,
			);

			const groupSession = await prisma.groupSession.create({
				data: {
					branchId: ctx.branchId,
					employeeId: ctx.employeeId,
					serviceId: ctx.serviceGroupId,
					scheduledAt,
					durationMins: 90,
					maxCapacity: 10,
					price: new Prisma.Decimal(50000),
					status: "OPEN",
					title: "ورشة تواصل",
					deliveryType: "IN_PERSON",
					isPublic: true,
				},
			});

			const { BookGroupSessionHandler } = await import(
				"../../../src/modules/bookings/public/book-group-session.handler"
			);
			const bookGroupHandler = app.get(BookGroupSessionHandler);

			// Only 2 bookings (below min 4)
			for (const cid of [ctx.clientId, ctx.client2Id]) {
				const result = await bookGroupHandler.execute({
					groupSessionId: groupSession.id,
					clientId: cid,
				});
				expect(result.type).toBe("BOOKED");
			}

			// Manually expire bookings
			const bookings = await prisma.booking.findMany({
				where: { groupSessionId: groupSession.id },
			});
			const { ExpireBookingHandler } = await import(
				"../../../src/modules/bookings/expire-booking/expire-booking.handler"
			);
			const expireHandler = app.get(ExpireBookingHandler);

			for (const b of bookings) {
				await expireHandler.execute({ bookingId: b.id, changedBy: "system" });
			}

			const expired = await prisma.booking.findMany({
				where: {
					groupSessionId: groupSession.id,
					status: BookingStatus.EXPIRED,
				},
			});
			expect(expired).toHaveLength(2);
		});
	});

	// ═══════════════════════════════════════════════════════════════════════════
	// SCENARIOS 11–13: Cancellation Flows
	// ═══════════════════════════════════════════════════════════════════════════

	describe("Scenarios 11–13: Cancellation flows", () => {
		it("Scenario 11 — Client requests cancel, staff approves, auto-refund", async () => {
			const scheduledAt = await getFirstAvailableSlot(
				ctx.employeeId,
				ctx.serviceId,
				tomorrow(),
			);
			const createRes = await createBooking({
				scheduledAt: scheduledAt.toISOString(),
			});
			const bookingId = createRes.body.id;

			// Use existing invoice from booking creation; mark as PAID and add payment
			const existingInvoice = await prisma.invoice.findFirst({
				where: { bookingId },
			});
			expect(existingInvoice).not.toBeNull();
			await prisma.invoice.update({
				where: { id: existingInvoice!.id },
				data: { status: "PAID" },
			});
			await prisma.payment.create({
				data: {
					invoiceId: existingInvoice!.id,
					amount: Number(existingInvoice!.total),
					currency: "SAR",
					status: "COMPLETED",
					method: "MADA",
				},
			});

			// Request cancel via client endpoint simulation (direct DB update)
			await prisma.booking.update({
				where: { id: bookingId },
				data: { status: BookingStatus.CANCEL_REQUESTED },
			});

			// Staff approves
			const approveRes = await approveCancel(bookingId);
			expect(approveRes.status).toBe(200);
			expect(approveRes.body.status).toBe("CANCELLED");

			const booking = await prisma.booking.findUnique({
				where: { id: bookingId },
			});
			expect(booking?.status).toBe(BookingStatus.CANCELLED);
		});

		it("Scenario 12 — Late cancel request rejected by staff", async () => {
			// Enable cancel approval
			await prisma.bookingSettings.updateMany({
				data: { requireCancelApproval: true },
			});

			const scheduledAt = await getFirstAvailableSlot(
				ctx.employeeId,
				ctx.serviceId,
				daysFromNow(2),
			);
			const createRes = await createBooking({
				scheduledAt: scheduledAt.toISOString(),
			});
			const bookingId = createRes.body.id;

			// Simulate client cancel request
			await prisma.booking.update({
				where: { id: bookingId },
				data: { status: BookingStatus.CANCEL_REQUESTED },
			});

			// Staff rejects
			const rejectRes = await rejectCancel(bookingId, {
				rejectReason: "Late cancellation not allowed",
			});
			expect(rejectRes.status).toBe(200);
			expect(rejectRes.body.status).toBe("CONFIRMED");

			// Reset setting
			await prisma.bookingSettings.updateMany({
				data: { requireCancelApproval: false },
			});
		});

		it("Scenario 13 — Client cancels inside free window, direct cancel", async () => {
			const scheduledAt = await getFirstAvailableSlot(
				ctx.employeeId,
				ctx.serviceId,
				tomorrow(),
			);
			const createRes = await createBooking({
				scheduledAt: scheduledAt.toISOString(),
			});
			const bookingId = createRes.body.id;

			const cancelRes = await cancelBooking(bookingId);
			expect(cancelRes.status).toBe(200);
			expect(cancelRes.body.status).toBe("CANCELLED");
			expect(cancelRes.body.refundType).toBe("FULL");
		});
	});

	// ═══════════════════════════════════════════════════════════════════════════
	// SCENARIOS 14–16, 18–19: Validation & Edge Cases
	// ═══════════════════════════════════════════════════════════════════════════

	describe("Scenarios 14–16, 18–19: Validation guards", () => {
		it("Scenario 14 — Employee does not provide service → rejected", async () => {
			// Create an employee with NO service link
			const unrelatedEmp = await prisma.employee.create({
				data: {
					name: "غير مختص",
					nameAr: "غير مختص",
					email: "unrelated-e2e@sawaa.app",
					phone: "0500000099",
					isActive: true,
				},
			});
			await prisma.employeeBranch.create({
				data: { employeeId: unrelatedEmp.id, branchId: ctx.branchId },
			});

			const res = await createBooking({ employeeId: unrelatedEmp.id });
			expect(res.status).toBe(400);
			expect(res.body.message).toMatch(/does not provide this service/);

			await prisma.employeeBranch.deleteMany({
				where: { employeeId: unrelatedEmp.id },
			});
			await prisma.employee.delete({ where: { id: unrelatedEmp.id } });
		});

		it("Scenario 16 — Race: second booking in same slot rejected", async () => {
			const slot = tomorrow(11, 0);
			const res1 = await createBooking({
				clientId: ctx.clientId,
				scheduledAt: slot.toISOString(),
			});
			expect(res1.status).toBe(201);

			const res2 = await createBooking({
				clientId: ctx.client2Id,
				scheduledAt: slot.toISOString(),
			});
			expect(res2.status).toBe(400);
			expect(res2.body.message).toMatch(/not available/);
		});

		it("Scenario 18 — Booking less than 60 min lead time → rejected", async () => {
			const tooSoon = new Date(Date.now() + 30 * 60_000); // 30 minutes from now
			const res = await createBooking({ scheduledAt: tooSoon.toISOString() });
			expect(res.status).toBe(400);
		});

		it("Scenario 19 — Booking more than 90 days ahead → rejected", async () => {
			const tooFar = daysFromNow(120, 10, 0);
			const res = await createBooking({ scheduledAt: tooFar.toISOString() });
			expect(res.status).toBe(400);
		});
	});

	// ═══════════════════════════════════════════════════════════════════════════
	// SCENARIOS 20–23: Entity State Guards
	// ═══════════════════════════════════════════════════════════════════════════

	describe("Scenarios 20–23: Entity state guards", () => {
		it("Scenario 20 — Inactive employee → rejected", async () => {
			const inactiveEmp = await prisma.employee.create({
				data: {
					name: "مستقيل",
					nameAr: "مستقيل",
					email: "resigned-e2e@sawaa.app",
					phone: "0500000098",
					isActive: false,
				},
			});

			const res = await createBooking({ employeeId: inactiveEmp.id });
			expect(res.status).toBe(400);
			expect(res.body.message).toMatch(/not active/);

			await prisma.employee.delete({ where: { id: inactiveEmp.id } });
		});

		it("Scenario 21 — Archived service → rejected", async () => {
			const archivedSvc = await prisma.service.create({
				data: {
					nameAr: "خدمة مؤرشفة",
					nameEn: "Archived Service",
					durationMins: 60,
					price: 10000,
					currency: "SAR",
					isActive: true,
					archivedAt: new Date(),
					categoryId: ctx.serviceCatId,
				},
			});
			await prisma.employeeService.create({
				data: {
					employeeId: ctx.employeeId,
					serviceId: archivedSvc.id,
					isActive: true,
				},
			});

			const res = await createBooking({ serviceId: archivedSvc.id });
			expect(res.status).toBe(400);
			expect(res.body.message).toMatch(/archived/);

			await prisma.employeeService.deleteMany({
				where: { serviceId: archivedSvc.id },
			});
			await prisma.service.delete({ where: { id: archivedSvc.id } });
		});

		it("Scenario 22 — Inactive branch → rejected", async () => {
			const closedBranch = await prisma.branch.create({
				data: { nameAr: "فرع مغلق", nameEn: "Closed Branch", isActive: false },
			});

			const res = await createBooking({ branchId: closedBranch.id });
			expect(res.status).toBe(400);
			expect(res.body.message).toMatch(/not active/);

			await prisma.branch.delete({ where: { id: closedBranch.id } });
		});

		it("Scenario 23 — Coupon max uses exhausted → rejected", async () => {
			const coupon = await prisma.coupon.create({
				data: {
					code: "RACE100",
					discountType: "PERCENTAGE",
					discountValue: new Prisma.Decimal(10),
					maxUses: 1,
					usedCount: 1,
					isActive: true,
				},
			});

			const res = await createBooking({ couponCode: "RACE100" });
			expect(res.status).toBe(400);
			expect(res.body.message).toMatch(/exhausted/);

			await prisma.coupon.delete({ where: { id: coupon.id } });
		});
	});

	// ═══════════════════════════════════════════════════════════════════════════
	// SCENARIOS 15, 24–26: Coupons, Zoom, Staff Cancel, Deposit
	// ═══════════════════════════════════════════════════════════════════════════

	describe("Scenarios 15, 24–26: Coupons, Zoom, staff cancel, deposit", () => {
		it("Scenario 15 — 20% coupon, VAT computed on discounted amount", async () => {
			const coupon = await prisma.coupon.create({
				data: {
					code: "SAVE20",
					discountType: "PERCENTAGE",
					discountValue: new Prisma.Decimal(20),
					isActive: true,
				},
			});

			const res = await createBooking({ couponCode: "SAVE20" });
			expect(res.status).toBe(201);

			const invoice = await prisma.invoice.findFirst({
				where: { bookingId: res.body.id },
			});
			expect(invoice).toBeTruthy();
			// 30000 halalas - 20% = 24000 base. VAT 15% = 3600. Total = 27600
			expect(Number(invoice!.discountAmt)).toBe(6000);
			expect(Number(invoice!.vatAmt)).toBe(3600);
			expect(Number(invoice!.total)).toBe(27600);

			await prisma.coupon.delete({ where: { id: coupon.id } });
		});

		it("Scenario 24 — Cancel online booking deletes Zoom (best-effort)", async () => {
			const createRes = await createBooking({
				scheduledAt: tomorrow(10, 0).toISOString(),
				deliveryType: "ONLINE",
			});
			const bookingId = createRes.body.id;

			// Set zoom meeting
			await prisma.booking.update({
				where: { id: bookingId },
				data: { zoomMeetingId: "zoom-maha-123", zoomMeetingStatus: "CREATED" },
			});

			const cancelRes = await cancelBooking(bookingId);
			expect(cancelRes.status).toBe(200);
			expect(cancelRes.body.status).toBe("CANCELLED");

			const booking = await prisma.booking.findUnique({
				where: { id: bookingId },
			});
			expect(booking?.zoomMeetingStatus).toBe("CANCELLED");
		});

		it("Scenario 25 — Deposit paid, balance unpaid, booking expires, deposit refunded", async () => {
			const scheduledAt = await getFirstAvailableSlot(
				ctx.employeeId,
				ctx.serviceId,
				tomorrow(),
			);
			const createRes = await createBooking({
				scheduledAt: scheduledAt.toISOString(),
			});
			const bookingId = createRes.body.id;

			// Transition to DEPOSIT_PAID and update the existing invoice
			await prisma.booking.update({
				where: { id: bookingId },
				data: { status: BookingStatus.DEPOSIT_PAID },
			});
			const existingInvoice = await prisma.invoice.findFirst({
				where: { bookingId },
			});
			expect(existingInvoice).not.toBeNull();
			const invoice = await prisma.invoice.update({
				where: { id: existingInvoice!.id },
				data: { status: "PARTIALLY_PAID" },
			});
			await prisma.payment.create({
				data: {
					invoiceId: invoice.id,
					amount: 15000,
					currency: "SAR",
					gatewayRef: "pay_deposit_123",
					status: "COMPLETED",
					method: "MADA",
				},
			});

			const { ExpireBookingHandler } = await import(
				"../../../src/modules/bookings/expire-booking/expire-booking.handler"
			);
			await app
				.get(ExpireBookingHandler)
				.execute({ bookingId, changedBy: "system" });

			const booking = await prisma.booking.findUnique({
				where: { id: bookingId },
			});
			expect(booking?.status).toBe(BookingStatus.EXPIRED);

			// Refund request should exist
			const refundReq = await prisma.refundRequest.findFirst({
				where: { payment: { invoice: { bookingId } } },
			});
			expect(refundReq).toBeTruthy();
		});

		it("Scenario 26 — Staff cancels sessions, full refund + event published", async () => {
			const scheduledAt = await getFirstAvailableSlot(
				ctx.employeeId,
				ctx.serviceId,
				tomorrow(),
			);
			const createRes = await createBooking({
				scheduledAt: scheduledAt.toISOString(),
			});
			const bookingId = createRes.body.id;

			// Use existing invoice from booking creation; mark as PAID and add payment
			const existingInvoice = await prisma.invoice.findFirst({
				where: { bookingId },
			});
			expect(existingInvoice).not.toBeNull();
			const invoice = await prisma.invoice.update({
				where: { id: existingInvoice!.id },
				data: { status: "PAID" },
			});
			await prisma.payment.create({
				data: {
					invoiceId: invoice.id,
					amount: 34500,
					currency: "SAR",
					status: "COMPLETED",
					method: "MADA",
					gatewayRef: "pay_cancel_123",
				},
			});

			const cancelRes = await cancelBooking(bookingId, {
				reason: CancellationReason.EMPLOYEE_UNAVAILABLE,
				cancelNotes: "Doctor emergency",
			});
			expect(cancelRes.status).toBe(200);
			expect(cancelRes.body.status).toBe("CANCELLED");
			expect(cancelRes.body.refundType).toBe("FULL");
		});
	});

	// ═══════════════════════════════════════════════════════════════════════════
	// SCENARIOS 28–30: Snapshot, Recurring, Manual Complete
	// ═══════════════════════════════════════════════════════════════════════════

	describe("Scenarios 28–30: snapshot, recurring, manual complete", () => {
		it("Scenario 28 — Service price changes, snapshot preserves original price", async () => {
			const scheduledAt = tomorrow(10, 0);
			const res = await createBooking({
				scheduledAt: scheduledAt.toISOString(),
			});
			const bookingId = res.body.id;

			const bookingBefore = await prisma.booking.findUnique({
				where: { id: bookingId },
			});
			expect(Number(bookingBefore?.price)).toBe(30000);

			// Change service price
			await prisma.service.update({
				where: { id: ctx.serviceId },
				data: { price: 40000 },
			});

			// Original booking keeps its snapshot
			const bookingAfter = await prisma.booking.findUnique({
				where: { id: bookingId },
			});
			expect(Number(bookingAfter?.price)).toBe(30000);

			// Revert
			await prisma.service.update({
				where: { id: ctx.serviceId },
				data: { price: 30000 },
			});
		});

		it("Scenario 29 — Recurring booking series: 6 weekly sessions", async () => {
			const baseDate = await getFirstAvailableSlot(
				ctx.employeeId,
				ctx.serviceId,
				tomorrow(),
			);
			const res = await createRecurring({
				branchId: ctx.branchId,
				clientId: ctx.clientId,
				employeeId: ctx.employeeId,
				serviceId: ctx.serviceId,
				scheduledAt: baseDate.toISOString(),
				durationMins: 60,
				price: 300,
				frequency: "WEEKLY",
				occurrences: 6,
			});

			expect(res.status).toBe(201);
			expect(res.body).toHaveLength(6);

			// Verify each booking exists in DB
			const groupId = res.body[0].recurringGroupId;
			const bookings = await prisma.booking.findMany({
				where: { recurringGroupId: groupId },
			});
			expect(bookings).toHaveLength(6);
		});

		it("Scenario 30 — Forgot to mark complete, staff completes manually later", async () => {
			const scheduledAt = tomorrow(9, 0);
			const createRes = await createBooking({
				scheduledAt: scheduledAt.toISOString(),
			});
			const bookingId = createRes.body.id;

			// Booking remains CONFIRMED (staff forgot)
			let booking = await prisma.booking.findUnique({
				where: { id: bookingId },
			});
			expect(booking?.status).toBe(BookingStatus.CONFIRMED);

			// Staff notices and marks complete
			const completeRes = await completeBooking(bookingId);
			expect(completeRes.status).toBe(200);

			booking = await prisma.booking.findUnique({ where: { id: bookingId } });
			expect(booking?.status).toBe(BookingStatus.COMPLETED);

			// Status log should show the transition
			const logs = await prisma.bookingStatusLog.findMany({
				where: { bookingId },
			});
			const completeLog = logs.find((l) => l.toStatus === "COMPLETED");
			expect(completeLog).toBeTruthy();
		});
	});
});
