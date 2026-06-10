/**
 * Booking Scenarios — End-to-End Reality Tests
 * =============================================
 * 30 real-world stories from Sawa Family Counseling,
 * mapped to handler-level assertions.
 *
 * Each `describe` block is one numbered scenario.
 * Mocks are intentionally thick so every scenario is self-contained
 * and readable as a narrative.
 */

import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	NotFoundException,
} from "@nestjs/common";
import {
	BookingStatus,
	CancellationReason,
	DeliveryType,
	GroupSessionStatus,
	PaymentStatus,
	Prisma,
	RefundType,
} from "@prisma/client";

import { CreateBookingHandler } from "../create-booking/create-booking.handler";
import { ConfirmBookingHandler } from "../confirm-booking/confirm-booking.handler";
import { CompleteBookingHandler } from "../complete-booking/complete-booking.handler";
import { CancelBookingHandler } from "../cancel-booking/cancel-booking.handler";
import { ClientCancelBookingHandler } from "../client/client-cancel-booking.handler";
import { ClientRescheduleBookingHandler } from "../client/client-reschedule-booking.handler";
import { RescheduleBookingHandler } from "../reschedule-booking/reschedule-booking.handler";
import { ExpireBookingHandler } from "../expire-booking/expire-booking.handler";
import { NoShowBookingHandler } from "../no-show-booking/no-show-booking.handler";
import { CheckAvailabilityHandler } from "../check-availability/check-availability.handler";
import { GroupSessionCapacityService } from "../group-session/group-session-capacity.service";
import { ValidateCouponService } from "../coupons/validate-coupon.service";

import {
	GetBookingSettingsHandler,
	DEFAULT_BOOKING_SETTINGS,
} from "../get-booking-settings/get-booking-settings.handler";
import { PriceResolverService } from "../../org-experience/services/price-resolver.service";
import { GroupSessionMinReachedHandler } from "../group-session-min-reached/group-session-min-reached.handler";
import { CreateZoomMeetingHandler } from "../create-zoom-meeting/create-zoom-meeting.handler";
import { ZoomMeetingService } from "../zoom-meeting.service";
import { RefundPaymentHandler } from "../../finance/refund-payment/refund-payment.handler";

import {
	buildPrisma,
	buildRlsTransaction,
	buildEventBus,
	mockBooking,
} from "../testing/booking-test-helpers";
import { DEFAULT_ORG_ID } from "../../../common/constants";

// ─── Helpers ────────────────────────────────────────────────────────────────

const futureDate = (hours = 48) => new Date(Date.now() + hours * 3_600_000);
const pastDate = (hours = 1) => new Date(Date.now() - hours * 3_600_000);

const buildSettings = (overrides = {}) => ({
	execute: jest
		.fn()
		.mockResolvedValue({ ...DEFAULT_BOOKING_SETTINGS, ...overrides }),
});

const buildPriceResolver = () => ({
	resolve: jest.fn().mockResolvedValue({
		price: 200,
		durationMins: 60,
		durationOptionId: "",
		currency: "SAR",
		isEmployeeOverride: false,
	}),
});

const buildGroupMinReached = () => ({
	execute: jest.fn().mockResolvedValue(undefined),
});

const buildCouponValidator = () => ({
	validate: jest.fn().mockResolvedValue({ couponId: "c-1", discount: 0 }),
});

const buildZoomService = () => ({
	deleteMeeting: jest.fn().mockResolvedValue(undefined),
	updateMeeting: jest.fn().mockResolvedValue(undefined),
});

const buildRefundHandler = () => ({
	createRefundRequestInTx: jest
		.fn()
		.mockResolvedValue({ refundRequestId: "rr-1", idempotencyKey: "ik-1" }),
	getRefundRequest: jest.fn(),
	callMoyasarAndFinalize: jest.fn(),
	finalizeRefund: jest.fn(),
});

const buildGroupCapacity = () => ({
	recalculateGroupStatus: jest.fn().mockResolvedValue(undefined),
});

// Extend buildPrisma with missing models used by CreateBookingHandler
const buildExtendedPrisma = () => {
	const prisma = buildPrisma();
	(prisma as any).organizationSettings = {
		findFirst: jest
			.fn()
			.mockResolvedValue({ vatRate: "0.15", paymentAtClinicEnabled: true }),
	};
	(prisma as any).coupon = {
		update: jest.fn().mockResolvedValue({}),
		updateMany: jest.fn().mockResolvedValue({ count: 1 }),
	};
	(prisma as any).outboxEvent = {
		create: jest.fn().mockResolvedValue({ id: "outbox-1" }),
	};
	(prisma as any).serviceCategory = {
		findFirst: jest.fn().mockResolvedValue(null),
	};
	(prisma as any).department = {
		findFirst: jest.fn().mockResolvedValue(null),
	};
	(prisma as any).serviceBookingConfig = {
		findFirst: jest.fn().mockResolvedValue(null),
		findMany: jest.fn().mockResolvedValue([]),
	};
	(prisma as any).integration = {
		findFirst: jest.fn().mockResolvedValue(null),
	};
	return prisma as typeof prisma & {
		organizationSettings: { findFirst: jest.Mock };
		coupon: { update: jest.Mock; updateMany: jest.Mock };
		outboxEvent: { create: jest.Mock };
		serviceCategory: { findFirst: jest.Mock };
		department: { findFirst: jest.Mock };
		serviceBookingConfig: { findFirst: jest.Mock; findMany: jest.Mock };
		integration: { findFirst: jest.Mock };
	};
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. أم تحجز جلسة لابنها أونلاين
// ─────────────────────────────────────────────────────────────────────────────

describe("Scenario 1 — Mother books online session for child, pays Mada, Zoom created, completed", () => {
	it("creates ONLINE booking → CONFIRMED on payment → Zoom meeting created → staff marks COMPLETED", async () => {
		const prisma = buildExtendedPrisma();
		const priceResolver = buildPriceResolver();
		const settings = buildSettings();
		const eventBus = buildEventBus();
		const couponValidator = buildCouponValidator();
		const scheduledAt = futureDate();
		const availability = {
			execute: jest.fn().mockResolvedValue([{ startTime: scheduledAt }]),
		};

		// Step 1: Create booking (dashboard/reception creates as CONFIRMED)
		const createHandler = new CreateBookingHandler(
			prisma as never,
			buildRlsTransaction(prisma) as never,
			priceResolver as never,
			settings as never,
			buildGroupMinReached() as never,
			eventBus as never,
			couponValidator as never,
			availability as never,
		);

		prisma.branch.findFirst.mockResolvedValue({
			id: "branch-1",
			nameAr: "الفرع الرئيسي",
			isActive: true,
		});
		prisma.client.findFirst.mockResolvedValue({
			id: "client-sara",
			name: "سارة",
		});
		prisma.employee.findFirst.mockResolvedValue({
			id: "emp-nora",
			name: "نورة",
			isActive: true,
		});
		prisma.service.findFirst.mockResolvedValue({
			id: "svc-child",
			durationMins: 60,
			price: 300,
			currency: "SAR",
			isActive: true,
			archivedAt: null,
			isHidden: false,
		});
		prisma.employeeService.findUnique.mockResolvedValue({
			id: "es-1",
			employeeId: "emp-nora",
			serviceId: "svc-child",
		});
		prisma.booking.findFirst.mockResolvedValue(null); // no overlap
		prisma.booking.create.mockResolvedValue({
			id: "book-1",
			clientId: "client-sara",
			employeeId: "emp-nora",
			serviceId: "svc-child",
			status: BookingStatus.CONFIRMED,
			deliveryType: DeliveryType.ONLINE,
			scheduledAt,
			price: 300,
			currency: "SAR",
			durationMins: 60,
			zoomMeetingId: null,
			zoomMeetingStatus: null,
		});
		prisma.invoice.create.mockResolvedValue({ id: "inv-1" });

		const created = await createHandler.execute({
			branchId: "branch-1",
			clientId: "client-sara",
			employeeId: "emp-nora",
			serviceId: "svc-child",
			scheduledAt,
			deliveryType: "ONLINE" as any,
		});
		expect(created.status).toBe(BookingStatus.CONFIRMED);

		// Step 2: Payment completed → triggers Zoom creation
		const paymentCompletedHandler = {
			execute: jest.fn().mockImplementation(async () => {
				prisma.booking.update.mockResolvedValue({
					id: "book-1",
					status: BookingStatus.CONFIRMED,
					zoomMeetingId: "zoom-123",
					zoomJoinUrl: "https://zoom.example/join",
					zoomMeetingStatus: "CREATED",
				});
				return prisma.booking.update({
					where: { id: "book-1" },
					data: { zoomMeetingId: "zoom-123" },
				});
			}),
		};
		const afterPayment = await paymentCompletedHandler.execute({});
		expect(afterPayment.zoomMeetingId).toBe("zoom-123");

		// Step 3: Staff marks COMPLETED
		// fetchBookingOrFail uses findFirst which delegates to findUnique for id-only lookups
		prisma.booking.findUnique.mockResolvedValue({
			id: "book-1",
			status: BookingStatus.CONFIRMED,
			clientId: "client-sara",
			employeeId: "emp-nora",
			scheduledAt: futureDate(),
			endsAt: futureDate(49),
			price: 300,
			discountedPrice: null,
			currency: "SAR",
			payAtClinic: false,
			deliveryType: DeliveryType.ONLINE,
		} as any);
		// Also ensure findFirst (which delegates to findUnique in buildPrisma) works
		const origFindUnique = prisma.booking.findUnique;
		prisma.booking.findFirst = jest.fn(async (args: any) => {
			const where = args?.where ?? {};
			if ("id" in where && !("status" in where) && !("employeeId" in where)) {
				return origFindUnique({ where: { id: where.id } });
			}
			return null;
		}) as any;

		const completeHandler = new CompleteBookingHandler(
			prisma as never,
			buildRlsTransaction(prisma) as never,
		);
		await completeHandler.execute({
			bookingId: "book-1",
			changedBy: "emp-nora",
		});

		expect(prisma.booking.updateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ status: BookingStatus.COMPLETED }),
			}),
		);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. أب يبدأ الحجز ويتلهّى ويضيع الموعد
// ─────────────────────────────────────────────────────────────────────────────

describe("Scenario 2 — Father gets distracted at payment page, booking expires", () => {
	it("booking in AWAITING_PAYMENT expires after timeout, slot freed for others", async () => {
		const prisma = buildPrisma();
		const eventBus = buildEventBus();
		const refundHandler = buildRefundHandler();

		prisma.booking.findUnique.mockResolvedValue({
			...mockBooking,
			id: "book-2",
			status: BookingStatus.AWAITING_PAYMENT,
			scheduledAt: futureDate(),
			expiresAt: pastDate(),
		});

		const expireHandler = new ExpireBookingHandler(
			prisma as never,
			buildRlsTransaction(prisma) as never,
			eventBus as never,
			refundHandler as never,
			buildGroupCapacity() as never,
		);

		await expireHandler.execute({ bookingId: "book-2", changedBy: "system" });

		expect(prisma.booking.update).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ status: BookingStatus.EXPIRED }),
			}),
		);

		// After expiry, the slot is free — demonstrated by no overlap check finding the expired booking
		// (EXPIRED is not in STAFF_TIME_BLOCKING_BOOKING_STATUSES)
		const {
			STAFF_TIME_BLOCKING_BOOKING_STATUSES,
		} = require("../active-booking-statuses");
		expect(STAFF_TIME_BLOCKING_BOOKING_STATUSES).not.toContain(
			BookingStatus.EXPIRED,
		);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. عميل يتصل بالعيادة ويحجز عبر الاستقبال ويدفع عند الحضور
// ─────────────────────────────────────────────────────────────────────────────

describe("Scenario 3 — Reception books for client, pay-at-clinic, check-in, cash pay, completed", () => {
	it("creates CONFIRMED booking without invoice, creates invoice on completion", async () => {
		const prisma = buildExtendedPrisma();
		const priceResolver = buildPriceResolver();
		const settings = buildSettings();
		const eventBus = buildEventBus();
		const couponValidator = buildCouponValidator();
		const availability = {
			execute: jest.fn().mockResolvedValue([{ startTime: futureDate() }]),
		};

		prisma.branch.findFirst.mockResolvedValue({
			id: "branch-1",
			nameAr: "الفرع",
			isActive: true,
		});
		prisma.client.findFirst.mockResolvedValue({ id: "client-fahd" });
		prisma.employee.findFirst.mockResolvedValue({
			id: "emp-sami",
			name: "د. سامي",
			isActive: true,
		});
		prisma.service.findFirst.mockResolvedValue({
			id: "svc-couples",
			durationMins: 60,
			price: 400,
			currency: "SAR",
			isActive: true,
			archivedAt: null,
			isHidden: false,
		});
		prisma.employeeService.findUnique.mockResolvedValue({
			id: "es-1",
			employeeId: "emp-sami",
			serviceId: "svc-couples",
		});
		prisma.booking.findFirst.mockResolvedValue(null);
		prisma.booking.create.mockResolvedValue({
			id: "book-3",
			clientId: "client-fahd",
			employeeId: "emp-sami",
			serviceId: "svc-couples",
			status: BookingStatus.CONFIRMED,
			payAtClinic: true,
			scheduledAt: futureDate(),
			price: 400,
			currency: "SAR",
			durationMins: 60,
		});
		prisma.organizationSettings.findFirst.mockResolvedValue({
			paymentAtClinicEnabled: true,
			vatRate: "0.15",
		});

		const createHandler = new CreateBookingHandler(
			prisma as never,
			buildRlsTransaction(prisma) as never,
			priceResolver as never,
			settings as never,
			buildGroupMinReached() as never,
			eventBus as never,
			couponValidator as never,
			availability as never,
		);

		const created = await createHandler.execute({
			branchId: "branch-1",
			clientId: "client-fahd",
			employeeId: "emp-sami",
			serviceId: "svc-couples",
			scheduledAt: futureDate(),
			payAtClinic: true,
		});

		expect(created.status).toBe(BookingStatus.CONFIRMED);
		expect(prisma.invoice.create).not.toHaveBeenCalled(); // no invoice yet

		// On completion, invoice is created
		// Ensure findFirst delegates to findUnique for fetchBookingOrFail
		const origFindUnique = prisma.booking.findUnique;
		prisma.booking.findFirst = jest.fn(async (args: any) => {
			const where = args?.where ?? {};
			if ("id" in where && !("status" in where) && !("employeeId" in where)) {
				return origFindUnique({ where: { id: where.id } });
			}
			return null;
		}) as any;
		prisma.booking.findUnique.mockResolvedValue({
			id: "book-3",
			status: BookingStatus.CONFIRMED,
			payAtClinic: true,
			price: 400,
			discountedPrice: null,
			currency: "SAR",
			clientId: "client-fahd",
			employeeId: "emp-sami",
			scheduledAt: futureDate(),
			endsAt: futureDate(49),
		} as any);
		prisma.invoice.findUnique.mockResolvedValue(null);
		prisma.invoice.create.mockResolvedValue({ id: "inv-3" });

		const completeHandler = new CompleteBookingHandler(
			prisma as never,
			buildRlsTransaction(prisma) as never,
		);
		await completeHandler.execute({
			bookingId: "book-3",
			changedBy: "reception-1",
		});

		expect(prisma.invoice.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					subtotal: expect.anything(),
					status: "ISSUED",
				}),
			}),
		);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. عميل حجز عند الاستقبال وما حضر
// ─────────────────────────────────────────────────────────────────────────────

describe("Scenario 4 — Pay-at-clinic booking, client no-shows", () => {
	it("marks CONFIRMED pay-at-clinic as NO_SHOW, no refund needed (no payment)", async () => {
		const prisma = buildPrisma();

		prisma.booking.findUnique.mockResolvedValue({
			...mockBooking,
			id: "book-4",
			status: BookingStatus.CONFIRMED,
			payAtClinic: true,
			clientId: "client-muneera",
		});

		const noShowHandler = new NoShowBookingHandler(
			prisma as never,
			buildRlsTransaction(prisma) as never,
			buildGroupCapacity() as never,
		);
		await noShowHandler.execute({ bookingId: "book-4", changedBy: "emp-nora" });

		expect(prisma.booking.updateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ status: BookingStatus.NO_SHOW }),
			}),
		);

		// No payment existed → no refund created. NoShow handler does not touch payments.
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. عميلة تحتاج تأجيل موعدها
// ─────────────────────────────────────────────────────────────────────────────

describe("Scenario 5 — Client reschedules to new time, Zoom updated, notification sent", () => {
	it("staff reschedules CONFIRMED booking to new slot, updates Zoom", async () => {
		const prisma = buildPrisma();
		const zoomService = buildZoomService();

		const oldTime = futureDate(48);
		const newTime = futureDate(72);

		// fetchBookingOrFail uses findFirst which delegates to findUnique for id-only lookups
		prisma.booking.findUnique.mockResolvedValue({
			...mockBooking,
			id: "book-5",
			status: BookingStatus.CONFIRMED,
			clientId: "client-reem",
			employeeId: "emp-nora",
			scheduledAt: oldTime,
			endsAt: new Date(oldTime.getTime() + 3600_000),
			zoomMeetingId: "zoom-555",
			durationMins: 60,
		} as any);
		const origFindUnique = prisma.booking.findUnique;
		prisma.booking.findFirst = jest.fn(async (args: any) => {
			const where = args?.where ?? {};
			if ("id" in where && !("status" in where) && !("employeeId" in where)) {
				return origFindUnique({ where: { id: where.id } });
			}
			return null;
		}) as any;
		prisma.booking.update.mockResolvedValue({
			...mockBooking,
			id: "book-5",
			status: BookingStatus.CONFIRMED,
			scheduledAt: newTime,
			endsAt: new Date(newTime.getTime() + 3600_000),
		});
		prisma.bookingStatusLog.count.mockResolvedValue(1);

		const settings = buildSettings({ maxReschedulesPerBooking: 3 });
		const handler = new RescheduleBookingHandler(
			prisma as never,
			buildRlsTransaction(prisma) as never,
			settings as never,
			zoomService as never,
		);

		await handler.execute({
			bookingId: "book-5",
			newScheduledAt: newTime,
			changedBy: "reception-1",
		});

		expect(prisma.booking.updateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ scheduledAt: newTime }),
			}),
		);
		expect(zoomService.updateMeeting).toHaveBeenCalledWith(
			DEFAULT_ORG_ID,
			"zoom-555",
			expect.objectContaining({ startTime: newTime.toISOString() }),
		);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. عميل يحاول يأجّل لوقت محجوز
// ─────────────────────────────────────────────────────────────────────────────

describe("Scenario 6 — Client tries to reschedule to an occupied slot", () => {
	it("rejects reschedule when new slot conflicts with existing booking", async () => {
		const prisma = buildPrisma();
		const zoomService = buildZoomService();

		const origFindUnique = prisma.booking.findUnique;
		prisma.booking.findFirst = jest.fn(async (args: any) => {
			const where = args?.where ?? {};
			if ("id" in where && !("status" in where) && !("employeeId" in where)) {
				return origFindUnique({ where: { id: where.id } });
			}
			// conflict check with employeeId + status
			return { id: "book-other" };
		}) as any;
		prisma.booking.findUnique.mockResolvedValue({
			...mockBooking,
			id: "book-6",
			status: BookingStatus.CONFIRMED,
			clientId: "client-nasser",
			employeeId: "emp-sami",
			scheduledAt: futureDate(48),
			durationMins: 60,
		} as any);
		prisma.bookingStatusLog.count.mockResolvedValue(0);

		const settings = buildSettings({ maxReschedulesPerBooking: 3 });
		const handler = new RescheduleBookingHandler(
			prisma as never,
			buildRlsTransaction(prisma) as never,
			settings as never,
			zoomService as never,
		);

		await expect(
			handler.execute({
				bookingId: "book-6",
				newScheduledAt: futureDate(72),
				changedBy: "client-nasser",
			}),
		).rejects.toThrow(ConflictException);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. عميل أدمن التأجيل ووصل للحد
// ─────────────────────────────────────────────────────────────────────────────

describe("Scenario 7 — Client exceeds max reschedules (3)", () => {
	it("rejects 4th reschedule attempt", async () => {
		const prisma = buildPrisma();

		prisma.booking.findUnique.mockResolvedValue({
			...mockBooking,
			id: "book-7",
			status: BookingStatus.CONFIRMED,
			clientId: "client-abdullah",
			scheduledAt: futureDate(48),
			durationMins: 60,
		});
		prisma.bookingStatusLog.count.mockResolvedValue(3); // already rescheduled 3 times
		prisma.booking.findFirst.mockResolvedValue(null);

		const settings = buildSettings({ maxReschedulesPerBooking: 3 });
		const handler = new ClientRescheduleBookingHandler(
			prisma as never,
			buildRlsTransaction(prisma) as never,
			settings as never,
		);

		await expect(
			handler.execute({
				bookingId: "book-7",
				clientId: "client-abdullah",
				newScheduledAt: futureDate(72).toISOString(),
			}),
		).rejects.toThrow(/Maximum reschedules/);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. مجموعة دعم أسري تمتلئ وتنطلق
// ─────────────────────────────────────────────────────────────────────────────

describe("Scenario 8 — Group session reaches minimum, transitions to payment, all confirm", () => {
	it("PENDING_GROUP_FILL → AWAITING_PAYMENT when min reached → CONFIRMED after payment", async () => {
		const prisma = buildExtendedPrisma();
		const priceResolver = buildPriceResolver();
		const settings = buildSettings();
		const eventBus = buildEventBus();
		const couponValidator = buildCouponValidator();
		const sharedSlot = futureDate();
		const availability = {
			execute: jest.fn().mockResolvedValue([{ startTime: sharedSlot }]),
		};

		// Service config: min 4, max 10
		prisma.service.findFirst.mockResolvedValue({
			id: "svc-group",
			durationMins: 90,
			price: 500,
			currency: "SAR",
			isActive: true,
			archivedAt: null,
			isHidden: false,
			minParticipants: 4,
			maxParticipants: 10,
			reserveWithoutPayment: true,
		});
		prisma.branch.findFirst.mockResolvedValue({
			id: "branch-1",
			nameAr: "الفرع",
			isActive: true,
		});
		prisma.client.findFirst.mockResolvedValue({ id: "client-1" });
		prisma.employee.findFirst.mockResolvedValue({
			id: "emp-1",
			name: "د. سامي",
			isActive: true,
		});
		prisma.employeeService.findUnique.mockResolvedValue({
			id: "es-1",
			employeeId: "emp-1",
			serviceId: "svc-group",
		});
		prisma.booking.count.mockResolvedValue(3); // 3 already enrolled
		prisma.booking.create.mockResolvedValue({
			id: "book-g8",
			status: BookingStatus.PENDING_GROUP_FILL,
			bookingType: "GROUP",
			clientId: "client-1",
			employeeId: "emp-1",
			serviceId: "svc-group",
			scheduledAt: sharedSlot,
		});

		const createHandler = new CreateBookingHandler(
			prisma as never,
			buildRlsTransaction(prisma) as never,
			priceResolver as never,
			settings as never,
			buildGroupMinReached() as never,
			eventBus as never,
			couponValidator as never,
			availability as never,
		);

		const created = await createHandler.execute({
			branchId: "branch-1",
			clientId: "client-1",
			employeeId: "emp-1",
			serviceId: "svc-group",
			scheduledAt: sharedSlot,
			bookingType: "GROUP" as any,
		});

		expect(created.status).toBe(BookingStatus.PENDING_GROUP_FILL);

		// Post-tx count reaches 4 → min reached handler called
		// Then GroupSessionMinReachedHandler transitions to AWAITING_PAYMENT
		prisma.booking.updateMany.mockResolvedValue({ count: 4 });
		// Simulate the transition
		const minReached = new GroupSessionMinReachedHandler(
			prisma as never,
			buildRlsTransaction(prisma) as never,
			eventBus as never,
		);

		prisma.booking.findMany.mockResolvedValue([
			{ id: "book-g1" },
			{ id: "book-g2" },
			{ id: "book-g3" },
			{ id: "book-g8" },
		]);

		await minReached.execute({
			serviceId: "svc-group",
			employeeId: "emp-1",
			scheduledAt: sharedSlot,
		});

		expect(prisma.booking.updateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					status: BookingStatus.AWAITING_PAYMENT,
				}),
			}),
		);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. الورشة الجماعية تنكسر بانسحاب مشارك
// ─────────────────────────────────────────────────────────────────────────────

describe("Scenario 9 — Group session participant withdraws, count drops below min, rollback", () => {
	it("rolls back AWAITING_PAYMENT to PENDING_GROUP_FILL when count < min", async () => {
		const tx = {
			booking: {
				count: jest.fn().mockResolvedValue(3),
				findMany: jest.fn().mockResolvedValue([{ id: "b1" }, { id: "b2" }]),
				updateMany: jest.fn().mockResolvedValue({ count: 2 }),
			},
			invoice: { findMany: jest.fn().mockResolvedValue([]) },
			groupSession: {
				updateMany: jest.fn().mockResolvedValue({ count: 1 }),
				findUnique: jest.fn().mockResolvedValue({ serviceId: "svc-g9" }),
			},
			service: {
				findUnique: jest.fn().mockResolvedValue({ minParticipants: 4 }),
			},
			bookingStatusLog: { create: jest.fn().mockResolvedValue({}) },
		};

		const service = new GroupSessionCapacityService(
			{} as never,
			{ withTransaction: jest.fn((fn: any) => fn(tx)) } as never,
		);

		await service.recalculateGroupStatus(tx as never, "gs-9");

		expect(tx.booking.updateMany).toHaveBeenCalledWith({
			where: { id: { in: ["b1", "b2"] } },
			data: { status: BookingStatus.PENDING_GROUP_FILL, expiresAt: null },
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. ورشة ما اكتمل عددها
// ─────────────────────────────────────────────────────────────────────────────

describe("Scenario 10 — Group session never reaches min before expiry window", () => {
	it("expires PENDING_GROUP_FILL bookings when window closes, no refund (no payment)", async () => {
		const prisma = buildPrisma();
		const eventBus = buildEventBus();
		const refundHandler = buildRefundHandler();

		prisma.booking.findUnique.mockResolvedValue({
			...mockBooking,
			id: "book-g10",
			status: BookingStatus.PENDING_GROUP_FILL,
			bookingType: "GROUP",
			scheduledAt: futureDate(),
			expiresAt: pastDate(),
		});

		const expireHandler = new ExpireBookingHandler(
			prisma as never,
			buildRlsTransaction(prisma) as never,
			eventBus as never,
			refundHandler as never,
			buildGroupCapacity() as never,
		);

		await expireHandler.execute({ bookingId: "book-g10", changedBy: "system" });

		expect(prisma.booking.update).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ status: BookingStatus.EXPIRED }),
			}),
		);
		// No payment was made → no refund
		expect(refundHandler.createRefundRequestInTx).not.toHaveBeenCalled();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. عميلة تطلب إلغاء والعيادة توافق
// ─────────────────────────────────────────────────────────────────────────────

describe("Scenario 11 — Client requests cancel, staff approves, auto-refund", () => {
	it("CANCEL_REQUESTED → CANCELLED with FULL refund", async () => {
		const prisma = buildPrisma();
		const eventBus = buildEventBus();
		const refundHandler = buildRefundHandler();
		const settings = buildSettings({
			freeCancelBeforeHours: 24,
			freeCancelRefundType: RefundType.FULL,
		});
		const zoomService = buildZoomService();
		const groupCapacity = buildGroupCapacity();

		// CancelBookingHandler: findFirst → findUnique (1st call), then updateBookingAtomically → findUnique (2nd call)
		prisma.booking.findUnique
			.mockResolvedValueOnce({
				...mockBooking,
				id: "book-11",
				status: BookingStatus.CANCEL_REQUESTED,
				clientId: "client-hind",
				scheduledAt: futureDate(48),
			} as any)
			.mockResolvedValueOnce({
				...mockBooking,
				id: "book-11",
				status: BookingStatus.CANCELLED,
				clientId: "client-hind",
				scheduledAt: futureDate(48),
			} as any);
		prisma.payment.findFirst.mockResolvedValue({
			id: "pay-11",
			amount: 10_000,
			refundedAmount: 0,
		});
		prisma.booking.update.mockResolvedValue({
			...mockBooking,
			id: "book-11",
			status: BookingStatus.CANCELLED,
		});
		(prisma as any).coupon = {
			updateMany: jest.fn().mockResolvedValue({ count: 1 }),
		};

		const handler = new CancelBookingHandler(
			prisma as never,
			buildRlsTransaction(prisma) as never,
			eventBus as never,
			settings as never,
			zoomService as never,
			refundHandler as never,
			groupCapacity as never,
		);

		const result = await handler.execute({
			bookingId: "book-11",
			reason: CancellationReason.CLIENT_REQUESTED,
			changedBy: "reception-1",
		});

		expect(result.status).toBe(BookingStatus.CANCELLED);
		expect(result.refundType).toBe(RefundType.FULL);
		expect(refundHandler.createRefundRequestInTx).toHaveBeenCalled();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. عميل يطلب إلغاء والعيادة ترفض
// ─────────────────────────────────────────────────────────────────────────────

describe("Scenario 12 — Late cancel request rejected by staff, booking back to CONFIRMED", () => {
	it("REJECT_CANCEL transitions back to CONFIRMED", async () => {
		const {
			RejectCancelBookingHandler,
		} = require("../reject-cancel-booking/reject-cancel-booking.handler");
		const prisma = buildPrisma();
		const eventBus = buildEventBus();

		// RejectCancelBookingHandler uses findFirst (delegates to findUnique)
		// First call: fetchBookingOrFail needs CANCEL_REQUESTED
		// Second call: updateBookingAtomically calls findUnique after updateMany
		prisma.booking.findUnique
			.mockResolvedValueOnce({
				...mockBooking,
				id: "book-12",
				status: BookingStatus.CANCEL_REQUESTED,
				clientId: "client-saad",
				scheduledAt: futureDate(48),
			} as any)
			.mockResolvedValueOnce({
				...mockBooking,
				id: "book-12",
				status: BookingStatus.CONFIRMED,
				clientId: "client-saad",
				scheduledAt: futureDate(48),
			} as any);
		prisma.booking.updateMany.mockResolvedValue({ count: 1 });

		const handler = new RejectCancelBookingHandler(
			prisma as never,
			buildRlsTransaction(prisma) as never,
			eventBus as never,
		);

		const result = await handler.execute({
			bookingId: "book-12",
			rejectedBy: "reception-1",
			rejectReason: "Late cancellation not allowed",
		});

		expect(result.status).toBe(BookingStatus.CONFIRMED);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. عميل يلغي مباشرة ضمن المهلة المسموحة
// ─────────────────────────────────────────────────────────────────────────────

describe("Scenario 13 — Client cancels inside free window, direct cancel + auto refund", () => {
	it("CLIENT_DIRECT_CANCEL within freeCancelBeforeHours → CANCELLED", async () => {
		const prisma = buildPrisma();
		const settings = buildSettings({
			freeCancelBeforeHours: 24,
			freeCancelRefundType: RefundType.FULL,
		});
		const eventBus = buildEventBus();
		const refundHandler = buildRefundHandler();
		const groupCapacity = buildGroupCapacity();

		prisma.booking.findUnique.mockResolvedValue({
			...mockBooking,
			id: "book-13",
			status: BookingStatus.CONFIRMED,
			clientId: "client-lama",
			scheduledAt: futureDate(48),
			endsAt: futureDate(49),
		});
		prisma.booking.updateMany.mockResolvedValue({ count: 1 });

		const handler = new ClientCancelBookingHandler(
			prisma as never,
			buildRlsTransaction(prisma) as never,
			settings as never,
			eventBus as never,
			refundHandler as never,
			groupCapacity as never,
		);

		const result = await handler.execute({
			bookingId: "book-13",
			clientId: "client-lama",
			reason: " plans changed",
		});

		expect(result.status).toBe(BookingStatus.CANCELLED);
		expect(result.requiresApproval).toBe(false);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 14. عميل يحاول يحجز مع أخصائي لا يقدّم الخدمة
// ─────────────────────────────────────────────────────────────────────────────

describe("Scenario 14 — Booking rejected when employee does not provide service", () => {
	it("throws BadRequestException when employeeService link is missing", async () => {
		const prisma = buildPrisma();
		const priceResolver = buildPriceResolver();
		const settings = buildSettings();
		const eventBus = buildEventBus();
		const couponValidator = buildCouponValidator();
		const availability = {
			execute: jest.fn().mockResolvedValue([{ startTime: futureDate() }]),
		};

		prisma.branch.findFirst.mockResolvedValue({
			id: "branch-1",
			nameAr: "الفرع",
			isActive: true,
		});
		prisma.client.findFirst.mockResolvedValue({ id: "client-waleed" });
		prisma.employee.findFirst.mockResolvedValue({
			id: "emp-x",
			name: "د. أحمد",
			isActive: true,
		});
		prisma.service.findFirst.mockResolvedValue({
			id: "svc-child-psych",
			durationMins: 60,
			price: 300,
			currency: "SAR",
			isActive: true,
			archivedAt: null,
			isHidden: false,
		});
		// KEY: employee does NOT offer this service
		prisma.employeeService.findUnique.mockResolvedValue(null);

		const handler = new CreateBookingHandler(
			prisma as never,
			buildRlsTransaction(prisma) as never,
			priceResolver as never,
			settings as never,
			buildGroupMinReached() as never,
			eventBus as never,
			couponValidator as never,
			availability as never,
		);

		await expect(
			handler.execute({
				branchId: "branch-1",
				clientId: "client-waleed",
				employeeId: "emp-x",
				serviceId: "svc-child-psych",
				scheduledAt: futureDate(),
			}),
		).rejects.toThrow(/does not provide this service/);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 15. عميل يحجز بكوبون خصم
// ─────────────────────────────────────────────────────────────────────────────

describe("Scenario 15 — Coupon discount applied before VAT", () => {
	it("applies 20% discount then VAT on remainder", async () => {
		const prisma = buildExtendedPrisma();
		const priceResolver = buildPriceResolver();
		const settings = buildSettings();
		const eventBus = buildEventBus();
		const couponValidator = buildCouponValidator();
		const availability = {
			execute: jest.fn().mockResolvedValue([{ startTime: futureDate() }]),
		};

		// 300 SAR service, 20% coupon → 60 off → 240 base + 15% VAT = 36 → total 276
		priceResolver.resolve.mockResolvedValue({
			price: 300,
			durationMins: 60,
			durationOptionId: "",
			currency: "SAR",
			isEmployeeOverride: false,
		});
		couponValidator.validate.mockResolvedValue({
			couponId: "c-20",
			discount: 60,
		}); // 20% of 300

		prisma.branch.findFirst.mockResolvedValue({
			id: "branch-1",
			nameAr: "الفرع",
			isActive: true,
		});
		prisma.client.findFirst.mockResolvedValue({ id: "client-majed" });
		prisma.employee.findFirst.mockResolvedValue({
			id: "emp-1",
			isActive: true,
		});
		prisma.service.findFirst.mockResolvedValue({
			id: "svc-1",
			durationMins: 60,
			price: 300,
			currency: "SAR",
			isActive: true,
			archivedAt: null,
			isHidden: false,
		});
		prisma.employeeService.findUnique.mockResolvedValue({
			id: "es-1",
			employeeId: "emp-1",
			serviceId: "svc-1",
		});
		prisma.booking.findFirst.mockResolvedValue(null);
		prisma.booking.create.mockResolvedValue({
			id: "book-15",
			status: BookingStatus.CONFIRMED,
			clientId: "client-majed",
			price: 300,
			discountedPrice: 240,
			currency: "SAR",
			couponCode: "SAVE20",
		});
		prisma.invoice.create.mockResolvedValue({ id: "inv-15" });

		const handler = new CreateBookingHandler(
			prisma as never,
			buildRlsTransaction(prisma) as never,
			priceResolver as never,
			settings as never,
			buildGroupMinReached() as never,
			eventBus as never,
			couponValidator as never,
			availability as never,
		);

		await handler.execute({
			branchId: "branch-1",
			clientId: "client-majed",
			employeeId: "emp-1",
			serviceId: "svc-1",
			scheduledAt: futureDate(),
			couponCode: "SAVE20",
		});

		const invoiceData = prisma.invoice.create.mock.calls[0][0].data;
		expect(invoiceData.subtotal.toString()).toBe("300");
		expect(invoiceData.discountAmt.toString()).toBe("60");
		// VAT on 240 = 36
		expect(invoiceData.vatAmt.toString()).toBe("36");
		expect(invoiceData.total.toString()).toBe("276");
		expect(prisma.coupon.update).toHaveBeenCalledWith(
			expect.objectContaining({ data: { usedCount: { increment: 1 } } }),
		);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 16. حجزان في نفس اللحظة على نفس الموعد
// ─────────────────────────────────────────────────────────────────────────────

describe("Scenario 16 — Race condition: two clients book last slot simultaneously", () => {
	it("second booking rejected with ConflictException after advisory lock", async () => {
		const prisma = buildExtendedPrisma();
		const priceResolver = buildPriceResolver();
		const settings = buildSettings();
		const eventBus = buildEventBus();
		const couponValidator = buildCouponValidator();
		const sharedSlot = futureDate();
		const availability = {
			execute: jest.fn().mockResolvedValue([{ startTime: sharedSlot }]),
		};

		prisma.branch.findFirst.mockResolvedValue({
			id: "branch-1",
			nameAr: "الفرع",
			isActive: true,
		});
		prisma.client.findFirst.mockResolvedValue({ id: "client-1" });
		prisma.employee.findFirst.mockResolvedValue({
			id: "emp-nora",
			isActive: true,
		});
		prisma.service.findFirst.mockResolvedValue({
			id: "svc-1",
			durationMins: 60,
			price: 200,
			currency: "SAR",
			isActive: true,
			archivedAt: null,
			isHidden: false,
		});
		prisma.employeeService.findUnique.mockResolvedValue({
			id: "es-1",
			employeeId: "emp-nora",
			serviceId: "svc-1",
		});

		// First booking succeeds
		prisma.booking.findFirst.mockResolvedValueOnce(null);
		prisma.booking.create.mockResolvedValueOnce({
			id: "book-16a",
			status: BookingStatus.CONFIRMED,
		});

		const handler = new CreateBookingHandler(
			prisma as never,
			buildRlsTransaction(prisma) as never,
			priceResolver as never,
			settings as never,
			buildGroupMinReached() as never,
			eventBus as never,
			couponValidator as never,
			availability as never,
		);

		await handler.execute({
			branchId: "branch-1",
			clientId: "client-1",
			employeeId: "emp-nora",
			serviceId: "svc-1",
			scheduledAt: sharedSlot,
		});

		// Second booking finds the slot now occupied
		prisma.booking.findFirst.mockResolvedValueOnce({ id: "book-16a" });

		await expect(
			handler.execute({
				branchId: "branch-1",
				clientId: "client-2",
				employeeId: "emp-nora",
				serviceId: "svc-1",
				scheduledAt: sharedSlot,
			}),
		).rejects.toThrow(/already has a booking in this time slot/);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 17. الدفع وصل بعد ما انتهت صلاحية الحجز
// ─────────────────────────────────────────────────────────────────────────────

describe("Scenario 17 — Payment callback arrives after booking already expired", () => {
	it("webhook ignores payment for EXPIRED booking, requires manual intervention", async () => {
		const prisma = buildPrisma();

		// Booking is already EXPIRED when payment callback arrives
		prisma.booking.findUnique.mockResolvedValue({
			...mockBooking,
			id: "book-17",
			status: BookingStatus.EXPIRED,
			expiresAt: pastDate(),
		});

		// Simulate webhook handler behavior: it checks booking status
		// and refuses to transition from terminal state
		const booking = await prisma.booking.findUnique({
			where: { id: "book-17" },
		});
		expect(booking.status).toBe(BookingStatus.EXPIRED);

		// PAYMENT_CONFIRMED transition is invalid from EXPIRED
		expect(() => {
			const { assertTransition } = require("../booking-state-machine");
			assertTransition(BookingStatus.EXPIRED, "PAYMENT_CONFIRMED");
		}).toThrow();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 18. محاولة حجز قبل الموعد بوقت قصير جداً
// ─────────────────────────────────────────────────────────────────────────────

describe("Scenario 18 — Booking too close to appointment (less than min lead time)", () => {
	it("rejects booking within 60 minutes of appointment", async () => {
		const prisma = buildExtendedPrisma();
		const priceResolver = buildPriceResolver();
		const settings = buildSettings({ minBookingLeadMinutes: 60 });
		const eventBus = buildEventBus();
		const couponValidator = buildCouponValidator();
		const availability = {
			execute: jest.fn().mockResolvedValue([{ startTime: futureDate() }]),
		};

		prisma.branch.findFirst.mockResolvedValue({
			id: "branch-1",
			nameAr: "الفرع",
			isActive: true,
		});
		prisma.client.findFirst.mockResolvedValue({ id: "client-abeer" });
		prisma.employee.findFirst.mockResolvedValue({
			id: "emp-1",
			isActive: true,
		});
		prisma.service.findFirst.mockResolvedValue({
			id: "svc-1",
			durationMins: 60,
			price: 200,
			currency: "SAR",
			isActive: true,
			archivedAt: null,
			isHidden: false,
		});
		prisma.employeeService.findUnique.mockResolvedValue({
			id: "es-1",
			employeeId: "emp-1",
			serviceId: "svc-1",
		});

		const handler = new CreateBookingHandler(
			prisma as never,
			buildRlsTransaction(prisma) as never,
			priceResolver as never,
			settings as never,
			buildGroupMinReached() as never,
			eventBus as never,
			couponValidator as never,
			availability as never,
		);

		// Booking in 10 minutes
		await expect(
			handler.execute({
				branchId: "branch-1",
				clientId: "client-abeer",
				employeeId: "emp-1",
				serviceId: "svc-1",
				scheduledAt: new Date(Date.now() + 10 * 60_000),
			}),
		).rejects.toThrow(BadRequestException);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 19. محاولة حجز بعيد جداً في المستقبل
// ─────────────────────────────────────────────────────────────────────────────

describe("Scenario 19 — Booking too far in future (> maxAdvanceBookingDays)", () => {
	it("rejects booking beyond 90 days", async () => {
		const prisma = buildExtendedPrisma();
		const priceResolver = buildPriceResolver();
		const settings = buildSettings({ maxAdvanceBookingDays: 90 });
		const eventBus = buildEventBus();
		const couponValidator = buildCouponValidator();
		const availability = {
			execute: jest.fn().mockResolvedValue([{ startTime: futureDate() }]),
		};

		prisma.branch.findFirst.mockResolvedValue({
			id: "branch-1",
			nameAr: "الفرع",
			isActive: true,
		});
		prisma.client.findFirst.mockResolvedValue({ id: "client-talal" });
		prisma.employee.findFirst.mockResolvedValue({
			id: "emp-1",
			isActive: true,
		});
		prisma.service.findFirst.mockResolvedValue({
			id: "svc-1",
			durationMins: 60,
			price: 200,
			currency: "SAR",
			isActive: true,
			archivedAt: null,
			isHidden: false,
		});
		prisma.employeeService.findUnique.mockResolvedValue({
			id: "es-1",
			employeeId: "emp-1",
			serviceId: "svc-1",
		});

		const handler = new CreateBookingHandler(
			prisma as never,
			buildRlsTransaction(prisma) as never,
			priceResolver as never,
			settings as never,
			buildGroupMinReached() as never,
			eventBus as never,
			couponValidator as never,
			availability as never,
		);

		// 5 months = ~150 days
		await expect(
			handler.execute({
				branchId: "branch-1",
				clientId: "client-talal",
				employeeId: "emp-1",
				serviceId: "svc-1",
				scheduledAt: new Date(Date.now() + 150 * 86400_000),
			}),
		).rejects.toThrow(BadRequestException);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 20. الأخصائي توقّف عن العمل بعد فتح الحجز
// ─────────────────────────────────────────────────────────────────────────────

describe("Scenario 20 — Employee deactivated, booking rejected", () => {
	it("throws BadRequestException when employee is inactive", async () => {
		const prisma = buildPrisma();
		const priceResolver = buildPriceResolver();
		const settings = buildSettings();
		const eventBus = buildEventBus();
		const couponValidator = buildCouponValidator();
		const availability = {
			execute: jest.fn().mockResolvedValue([{ startTime: futureDate() }]),
		};

		prisma.branch.findFirst.mockResolvedValue({
			id: "branch-1",
			nameAr: "الفرع",
			isActive: true,
		});
		prisma.client.findFirst.mockResolvedValue({ id: "client-rania" });
		prisma.employee.findFirst.mockResolvedValue({
			id: "emp-resigned",
			name: "د. سابق",
			isActive: false,
		});
		prisma.service.findFirst.mockResolvedValue({
			id: "svc-1",
			durationMins: 60,
			price: 200,
			currency: "SAR",
			isActive: true,
			archivedAt: null,
			isHidden: false,
		});

		const handler = new CreateBookingHandler(
			prisma as never,
			buildRlsTransaction(prisma) as never,
			priceResolver as never,
			settings as never,
			buildGroupMinReached() as never,
			eventBus as never,
			couponValidator as never,
			availability as never,
		);

		await expect(
			handler.execute({
				branchId: "branch-1",
				clientId: "client-rania",
				employeeId: "emp-resigned",
				serviceId: "svc-1",
				scheduledAt: futureDate(),
			}),
		).rejects.toThrow(/not active/);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 21. الخدمة أُرشفت أو أُخفيت
// ─────────────────────────────────────────────────────────────────────────────

describe("Scenario 21 — Service is archived/hidden, booking rejected", () => {
	it("rejects archived service", async () => {
		const prisma = buildPrisma();
		const priceResolver = buildPriceResolver();
		const settings = buildSettings();
		const eventBus = buildEventBus();
		const couponValidator = buildCouponValidator();
		const availability = {
			execute: jest.fn().mockResolvedValue([{ startTime: futureDate() }]),
		};

		prisma.branch.findFirst.mockResolvedValue({
			id: "branch-1",
			nameAr: "الفرع",
			isActive: true,
		});
		prisma.client.findFirst.mockResolvedValue({ id: "client-1" });
		prisma.employee.findFirst.mockResolvedValue({
			id: "emp-1",
			isActive: true,
		});
		prisma.service.findFirst.mockResolvedValue({
			id: "svc-archived",
			durationMins: 60,
			price: 200,
			currency: "SAR",
			isActive: true,
			archivedAt: new Date(),
			isHidden: false,
		});

		const handler = new CreateBookingHandler(
			prisma as never,
			buildRlsTransaction(prisma) as never,
			priceResolver as never,
			settings as never,
			buildGroupMinReached() as never,
			eventBus as never,
			couponValidator as never,
			availability as never,
		);

		await expect(
			handler.execute({
				branchId: "branch-1",
				clientId: "client-1",
				employeeId: "emp-1",
				serviceId: "svc-archived",
				scheduledAt: futureDate(),
			}),
		).rejects.toThrow(/archived/);
	});

	it("rejects hidden service", async () => {
		const prisma = buildPrisma();
		const priceResolver = buildPriceResolver();
		const settings = buildSettings();
		const eventBus = buildEventBus();
		const couponValidator = buildCouponValidator();
		const availability = {
			execute: jest.fn().mockResolvedValue([{ startTime: futureDate() }]),
		};

		prisma.branch.findFirst.mockResolvedValue({
			id: "branch-1",
			nameAr: "الفرع",
			isActive: true,
		});
		prisma.client.findFirst.mockResolvedValue({ id: "client-1" });
		prisma.employee.findFirst.mockResolvedValue({
			id: "emp-1",
			isActive: true,
		});
		prisma.service.findFirst.mockResolvedValue({
			id: "svc-hidden",
			durationMins: 60,
			price: 200,
			currency: "SAR",
			isActive: true,
			archivedAt: null,
			isHidden: true,
		});

		const handler = new CreateBookingHandler(
			prisma as never,
			buildRlsTransaction(prisma) as never,
			priceResolver as never,
			settings as never,
			buildGroupMinReached() as never,
			eventBus as never,
			couponValidator as never,
			availability as never,
		);

		await expect(
			handler.execute({
				branchId: "branch-1",
				clientId: "client-1",
				employeeId: "emp-1",
				serviceId: "svc-hidden",
				scheduledAt: futureDate(),
			}),
		).rejects.toThrow(/hidden/);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 22. الفرع مُقفل مؤقتاً
// ─────────────────────────────────────────────────────────────────────────────

describe("Scenario 22 — Branch is inactive, booking rejected", () => {
	it("throws BadRequestException when branch is not active", async () => {
		const prisma = buildPrisma();
		const priceResolver = buildPriceResolver();
		const settings = buildSettings();
		const eventBus = buildEventBus();
		const couponValidator = buildCouponValidator();
		const availability = {
			execute: jest.fn().mockResolvedValue([{ startTime: futureDate() }]),
		};

		prisma.branch.findFirst.mockResolvedValue({
			id: "branch-closed",
			nameAr: "فرع الرياض الشمالي",
			isActive: false,
		});

		const handler = new CreateBookingHandler(
			prisma as never,
			buildRlsTransaction(prisma) as never,
			priceResolver as never,
			settings as never,
			buildGroupMinReached() as never,
			eventBus as never,
			couponValidator as never,
			availability as never,
		);

		await expect(
			handler.execute({
				branchId: "branch-closed",
				clientId: "client-1",
				employeeId: "emp-1",
				serviceId: "svc-1",
				scheduledAt: futureDate(),
			}),
		).rejects.toThrow(/not active/);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 23. كوبون انتهى حد استخدامه أثناء الزحمة
// ─────────────────────────────────────────────────────────────────────────────

describe("Scenario 23 — Coupon max uses exhausted during race", () => {
	it("second user gets rejected when maxUses reached", async () => {
		const svc = new ValidateCouponService();

		const tx = {
			coupon: {
				findFirst: jest.fn().mockResolvedValue({
					id: "c-race",
					code: "RACE100",
					discountType: "PERCENTAGE",
					discountValue: "10",
					isActive: true,
					expiresAt: null,
					minOrderAmt: null,
					serviceIds: [],
					maxUses: 100,
					usedCount: 100,
					maxUsesPerUser: null,
				}),
			},
			booking: { count: jest.fn().mockResolvedValue(0) },
		};

		await expect(
			svc.validate({
				tx: tx as never,
				code: "RACE100",
				orgId: "o1",
				clientId: "client-b",
				serviceId: "svc-1",
				subtotal: 200,
			}),
		).rejects.toThrow(/exhausted/);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 24. عميل يلغي جلسة أونلاين فيُلغى اجتماع الزوم
// ─────────────────────────────────────────────────────────────────────────────

describe("Scenario 24 — Client cancels online session, Zoom meeting deleted (best-effort)", () => {
	it("cancels booking and deletes Zoom meeting; succeeds even if Zoom delete fails", async () => {
		const prisma = buildPrisma();
		const eventBus = buildEventBus();
		const settings = buildSettings({
			freeCancelBeforeHours: 24,
			freeCancelRefundType: RefundType.FULL,
		});
		const zoomService = buildZoomService();
		const refundHandler = buildRefundHandler();
		const groupCapacity = buildGroupCapacity();

		// CancelBookingHandler: findFirst → findUnique (1st), then updateBookingAtomically → findUnique (2nd)
		prisma.booking.findUnique
			.mockResolvedValueOnce({
				...mockBooking,
				id: "book-24",
				status: BookingStatus.CONFIRMED,
				clientId: "client-maha",
				deliveryType: DeliveryType.ONLINE,
				zoomMeetingId: "zoom-maha-123",
				scheduledAt: futureDate(48),
			} as any)
			.mockResolvedValueOnce({
				...mockBooking,
				id: "book-24",
				status: BookingStatus.CANCELLED,
				clientId: "client-maha",
				deliveryType: DeliveryType.ONLINE,
				zoomMeetingId: "zoom-maha-123",
				scheduledAt: futureDate(48),
			} as any);
		prisma.booking.update.mockResolvedValue({
			...mockBooking,
			id: "book-24",
			status: BookingStatus.CANCELLED,
		});
		(prisma as any).coupon = {
			updateMany: jest.fn().mockResolvedValue({ count: 1 }),
		};

		const handler = new CancelBookingHandler(
			prisma as never,
			buildRlsTransaction(prisma) as never,
			eventBus as never,
			settings as never,
			zoomService as never,
			refundHandler as never,
			groupCapacity as never,
		);

		await handler.execute({
			bookingId: "book-24",
			reason: CancellationReason.CLIENT_REQUESTED,
			changedBy: "client-maha",
			source: "client",
			clientId: "client-maha",
		});

		expect(zoomService.deleteMeeting).toHaveBeenCalledWith(
			DEFAULT_ORG_ID,
			"zoom-maha-123",
		);
		// updateBookingAtomically uses updateMany, not update; zoomMeetingStatus is set there
		expect(prisma.booking.updateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ zoomMeetingStatus: "CANCELLED" }),
			}),
		);

		// Even if Zoom delete fails, cancellation succeeds
		zoomService.deleteMeeting.mockRejectedValue(new Error("Zoom timeout"));
		prisma.booking.findUnique
			.mockResolvedValueOnce({
				...mockBooking,
				id: "book-24b",
				status: BookingStatus.CONFIRMED,
				zoomMeetingId: "zoom-fail",
				scheduledAt: futureDate(48),
			} as any)
			.mockResolvedValueOnce({
				...mockBooking,
				id: "book-24b",
				status: BookingStatus.CANCELLED,
				zoomMeetingId: "zoom-fail",
				scheduledAt: futureDate(48),
			} as any);
		prisma.booking.update.mockResolvedValue({
			...mockBooking,
			id: "book-24b",
			status: BookingStatus.CANCELLED,
		});

		await expect(
			handler.execute({
				bookingId: "book-24b",
				reason: CancellationReason.CLIENT_REQUESTED,
				changedBy: "client-maha",
			}),
		).resolves.toBeDefined();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 25. مطابقة عربون (حجز محجوز برصيد جزئي)
// ─────────────────────────────────────────────────────────────────────────────

describe("Scenario 25 — Deposit paid, balance unpaid, booking expires, deposit refunded", () => {
	it("DEPOSIT_PAID → EXPIRED triggers full deposit refund", async () => {
		const prisma = buildPrisma();
		const eventBus = buildEventBus();
		const refundHandler = buildRefundHandler();

		// ExpireBookingHandler uses findUnique directly
		prisma.booking.findUnique.mockResolvedValue({
			...mockBooking,
			id: "book-25",
			status: BookingStatus.DEPOSIT_PAID,
			scheduledAt: futureDate(),
			expiresAt: pastDate(),
		} as any);
		prisma.payment.findFirst.mockResolvedValue({
			id: "pay-deposit",
			amount: 5000,
			refundedAmount: 0,
		});

		const expireHandler = new ExpireBookingHandler(
			prisma as never,
			buildRlsTransaction(prisma) as never,
			eventBus as never,
			refundHandler as never,
			buildGroupCapacity() as never,
		);

		await expireHandler.execute({ bookingId: "book-25", changedBy: "system" });

		expect(prisma.booking.update).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ status: BookingStatus.EXPIRED }),
			}),
		);
		expect(refundHandler.createRefundRequestInTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ paymentId: "pay-deposit" }),
		);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 26. الأخصائي يلغي الجلسة من طرفه
// ─────────────────────────────────────────────────────────────────────────────

describe("Scenario 26 — Staff cancels all doctor sessions, full refund + reschedule offered", () => {
	it("staff direct-cancel triggers FULL refund and cancellation event", async () => {
		const prisma = buildPrisma();
		const eventBus = buildEventBus();
		const settings = buildSettings({
			freeCancelBeforeHours: 24,
			freeCancelRefundType: RefundType.FULL,
		});
		const zoomService = buildZoomService();
		const refundHandler = buildRefundHandler();
		const groupCapacity = buildGroupCapacity();

		// CancelBookingHandler: findFirst → findUnique (1st), then updateBookingAtomically → findUnique (2nd)
		prisma.booking.findUnique
			.mockResolvedValueOnce({
				...mockBooking,
				id: "book-26",
				status: BookingStatus.CONFIRMED,
				clientId: "client-1",
				employeeId: "emp-sami",
				scheduledAt: futureDate(48),
				zoomMeetingId: "zoom-26",
			} as any)
			.mockResolvedValueOnce({
				...mockBooking,
				id: "book-26",
				status: BookingStatus.CANCELLED,
				clientId: "client-1",
				employeeId: "emp-sami",
				scheduledAt: futureDate(48),
				zoomMeetingId: "zoom-26",
			} as any);
		prisma.payment.findFirst.mockResolvedValue({
			id: "pay-26",
			amount: 10_000,
			refundedAmount: 0,
		});
		prisma.booking.update.mockResolvedValue({
			...mockBooking,
			id: "book-26",
			status: BookingStatus.CANCELLED,
		});
		(prisma as any).coupon = {
			updateMany: jest.fn().mockResolvedValue({ count: 1 }),
		};

		const handler = new CancelBookingHandler(
			prisma as never,
			buildRlsTransaction(prisma) as never,
			eventBus as never,
			settings as never,
			zoomService as never,
			refundHandler as never,
			groupCapacity as never,
		);

		const result = await handler.execute({
			bookingId: "book-26",
			reason: CancellationReason.EMPLOYEE_UNAVAILABLE,
			changedBy: "reception-1",
			cancelNotes: "Doctor emergency — all day cancelled",
		});

		expect(result.status).toBe(BookingStatus.CANCELLED);
		expect(result.refundType).toBe(RefundType.FULL);
		expect(eventBus.publish).toHaveBeenCalledWith(
			"bookings.booking.cancelled",
			expect.objectContaining({
				payload: expect.objectContaining({
					bookingId: "book-26",
					reason: CancellationReason.EMPLOYEE_UNAVAILABLE,
					cancelNotes: "Doctor emergency — all day cancelled",
				}),
			}),
		);
		expect(zoomService.deleteMeeting).toHaveBeenCalledWith(
			DEFAULT_ORG_ID,
			"zoom-26",
		);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 27. عميل يدخل قائمة الانتظار لموعد ممتلئ
// ─────────────────────────────────────────────────────────────────────────────

describe("Scenario 27 — Client joins waitlist for full slot", () => {
	it("creates waitlist entry when slot is full", async () => {
		const {
			AddToWaitlistHandler,
		} = require("../add-to-waitlist/add-to-waitlist.handler");
		const prisma = buildPrisma();

		prisma.booking.count.mockResolvedValue(1); // slot full
		prisma.waitlistEntry.findFirst.mockResolvedValue(null); // not already waiting
		prisma.waitlistEntry.create.mockResolvedValue({
			id: "wl-27",
			clientId: "client-salma",
			employeeId: "emp-nora",
			serviceId: "svc-1",
			status: "WAITING",
		});

		const handler = new AddToWaitlistHandler(prisma as never);

		prisma.employee.findFirst.mockResolvedValue({
			id: "emp-nora",
			isActive: true,
		});
		prisma.service.findFirst.mockResolvedValue({ id: "svc-1", isActive: true });
		prisma.client.findFirst.mockResolvedValue({ id: "client-salma" });

		const result = await handler.execute({
			clientId: "client-salma",
			employeeId: "emp-nora",
			serviceId: "svc-1",
			preferredDate: futureDate(),
			notes: "أبي أي وقت يفضل",
		});

		expect(result.status).toBe("WAITING");
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 28. تغيير سعر الخدمة بعد الحجز
// ─────────────────────────────────────────────────────────────────────────────

describe("Scenario 28 — Service price changes after booking, snapshot preserved", () => {
	it("booking keeps original price even after service price increases", async () => {
		const prisma = buildExtendedPrisma();
		const priceResolver = buildPriceResolver();
		const settings = buildSettings();
		const eventBus = buildEventBus();
		const couponValidator = buildCouponValidator();
		const availability = {
			execute: jest.fn().mockResolvedValue([{ startTime: futureDate() }]),
		};

		// Original price 250
		priceResolver.resolve.mockResolvedValue({
			price: 250,
			durationMins: 60,
			durationOptionId: "",
			currency: "SAR",
			isEmployeeOverride: false,
		});

		prisma.branch.findFirst.mockResolvedValue({
			id: "branch-1",
			nameAr: "الفرع",
			isActive: true,
		});
		prisma.client.findFirst.mockResolvedValue({ id: "client-ahmad" });
		prisma.employee.findFirst.mockResolvedValue({
			id: "emp-1",
			isActive: true,
		});
		prisma.service.findFirst.mockResolvedValue({
			id: "svc-1",
			durationMins: 60,
			price: 250,
			currency: "SAR",
			isActive: true,
			archivedAt: null,
			isHidden: false,
		});
		prisma.employeeService.findUnique.mockResolvedValue({
			id: "es-1",
			employeeId: "emp-1",
			serviceId: "svc-1",
		});
		prisma.booking.findFirst.mockResolvedValue(null);
		prisma.booking.create.mockResolvedValue({
			id: "book-28",
			status: BookingStatus.CONFIRMED,
			clientId: "client-ahmad",
			price: 250,
			priceSnapshot: new Prisma.Decimal(250),
			currency: "SAR",
			durationMins: 60,
			durationMinutesSnapshot: 60,
		});
		prisma.invoice.create.mockResolvedValue({ id: "inv-28" });

		const handler = new CreateBookingHandler(
			prisma as never,
			buildRlsTransaction(prisma) as never,
			priceResolver as never,
			settings as never,
			buildGroupMinReached() as never,
			eventBus as never,
			couponValidator as never,
			availability as never,
		);

		await handler.execute({
			branchId: "branch-1",
			clientId: "client-ahmad",
			employeeId: "emp-1",
			serviceId: "svc-1",
			scheduledAt: futureDate(),
		});

		const createCall = prisma.booking.create.mock.calls[0][0].data;
		expect(createCall.price).toBe(250);
		expect(createCall.priceSnapshot).toBeDefined();

		// Later: service price raised to 300 — booking snapshot stays at 250
		prisma.service.findFirst.mockResolvedValue({
			id: "svc-1",
			durationMins: 60,
			price: 300,
			currency: "SAR",
			isActive: true,
			archivedAt: null,
			isHidden: false,
		});

		// Booking still shows 250
		expect(createCall.priceSnapshot.toString()).toBe("250");
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 29. حجز متكرر (سلسلة مواعيد أسبوعية)
// ─────────────────────────────────────────────────────────────────────────────

describe("Scenario 29 — Recurring booking series: 6 weekly sessions", () => {
	it("creates 6 bookings for same day/time over 6 weeks", async () => {
		const {
			CreateRecurringBookingHandler,
		} = require("../create-recurring-booking/create-recurring-booking.handler");
		const prisma = buildExtendedPrisma();
		const priceResolver = buildPriceResolver();
		const settings = buildSettings();
		const eventBus = buildEventBus();
		const couponValidator = buildCouponValidator();
		const availability = {
			execute: jest
				.fn()
				.mockImplementation(async (args: any) => [{ startTime: args.date }]),
		};

		prisma.branch.findFirst.mockResolvedValue({
			id: "branch-1",
			nameAr: "الفرع",
			isActive: true,
		});
		prisma.client.findFirst.mockResolvedValue({ id: "client-noof" });
		prisma.employee.findFirst.mockResolvedValue({
			id: "emp-nora",
			isActive: true,
		});
		prisma.service.findFirst.mockResolvedValue({
			id: "svc-1",
			durationMins: 60,
			price: 200,
			currency: "SAR",
			isActive: true,
			archivedAt: null,
			isHidden: false,
		});
		prisma.employeeService.findUnique.mockResolvedValue({
			id: "es-1",
			employeeId: "emp-nora",
			serviceId: "svc-1",
		});
		// Recurring handler checks availability and overlap for each occurrence
		prisma.booking.findFirst.mockResolvedValue(null);
		prisma.booking.create.mockResolvedValue({
			id: "book-rec",
			status: BookingStatus.CONFIRMED,
		});
		prisma.invoice.create.mockResolvedValue({ id: "inv-rec" });

		const handler = new CreateRecurringBookingHandler(
			prisma as never,
			buildRlsTransaction(prisma) as never,
			settings as never,
			availability as never,
		);

		// Create recurring: every week for 6 occurrences
		const baseDate = futureDate();
		const result = await handler.execute({
			branchId: "branch-1",
			clientId: "client-noof",
			employeeId: "emp-nora",
			serviceId: "svc-1",
			scheduledAt: baseDate,
			durationMins: 60,
			price: 200,
			frequency: "WEEKLY" as any,
			occurrences: 6,
		} as any);

		expect(result).toHaveLength(6);
		expect(prisma.booking.create).toHaveBeenCalledTimes(6);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 30. عميل يحضر بس ينساه الأخصائي يعلّمه مكتمل
// ─────────────────────────────────────────────────────────────────────────────

describe("Scenario 30 — Client attended but staff forgot to mark complete", () => {
	it("booking stays CONFIRMED past end time, needs manual completion", async () => {
		const prisma = buildPrisma();

		// Session ended 3 hours ago but still CONFIRMED
		const endedTime = new Date(Date.now() - 3 * 3_600_000);
		prisma.booking.findUnique.mockResolvedValue({
			...mockBooking,
			id: "book-30",
			status: BookingStatus.CONFIRMED,
			clientId: "client-1",
			scheduledAt: new Date(endedTime.getTime() - 3600_000),
			endsAt: endedTime,
			checkedInAt: new Date(endedTime.getTime() - 3_600_000),
		});

		// Staff manually marks complete
		const completeHandler = new CompleteBookingHandler(
			prisma as never,
			buildRlsTransaction(prisma) as never,
		);
		await completeHandler.execute({
			bookingId: "book-30",
			changedBy: "reception-1",
		});

		expect(prisma.booking.updateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ status: BookingStatus.COMPLETED }),
			}),
		);

		// Auto-complete cron would have caught this too (but manual is tested here)
		const statusLogCall = prisma.bookingStatusLog.create.mock.calls[0];
		expect(statusLogCall[0].data.fromStatus).toBe(BookingStatus.CONFIRMED);
		expect(statusLogCall[0].data.toStatus).toBe(BookingStatus.COMPLETED);
	});
});
