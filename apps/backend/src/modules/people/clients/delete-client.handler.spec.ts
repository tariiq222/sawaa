import { Test } from "@nestjs/testing";
import { NotFoundException, ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { DeleteClientHandler } from "./delete-client.handler";
import { PrismaService, RlsTransactionService } from "../../../infrastructure/database";
import { ACTIVE_BOOKING_STATUSES } from "../../bookings/active-booking-statuses";

describe("DeleteClientHandler", () => {
	let handler: DeleteClientHandler;
	let prisma: {
		$queryRaw: jest.Mock;
		client: { findFirst: jest.Mock; update: jest.Mock };
		booking: { count: jest.Mock };
		invoice: { count: jest.Mock };
		programEnrollment: { count: jest.Mock };
		rating: { count: jest.Mock };
	};
	let rlsTransaction: { withTransaction: jest.Mock };

	beforeEach(async () => {
		prisma = {
			$queryRaw: jest.fn().mockResolvedValue([]),
			client: { findFirst: jest.fn(), update: jest.fn().mockResolvedValue({}) },
			booking: { count: jest.fn().mockResolvedValue(0) },
			invoice: { count: jest.fn().mockResolvedValue(0) },
			programEnrollment: { count: jest.fn().mockResolvedValue(0) },
			rating: { count: jest.fn().mockResolvedValue(0) },
		};
		rlsTransaction = {
			withTransaction: jest.fn(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
		};

		const module = await Test.createTestingModule({
			providers: [
				DeleteClientHandler,
				{ provide: PrismaService, useValue: prisma },
				{ provide: RlsTransactionService, useValue: rlsTransaction },
			],
		}).compile();

		handler = module.get(DeleteClientHandler);
	});

	it("throws when client not found", async () => {
		prisma.client.findFirst.mockResolvedValue(null);
		await expect(handler.execute({ clientId: "c1" })).rejects.toThrow(
			NotFoundException,
		);
	});

	it("blocks when active bookings exist", async () => {
		prisma.client.findFirst.mockResolvedValue({
			id: "c1",
			phone: "+966500000000",
			notes: "",
		});
		prisma.booking.count.mockResolvedValue(2);
		await expect(handler.execute({ clientId: "c1" })).rejects.toThrow("2 حجز");
	});

	it.each(ACTIVE_BOOKING_STATUSES)("blocks deletion for %s", async (status) => {
		prisma.client.findFirst.mockResolvedValue({ id: "c1", phone: null, notes: "" });
		prisma.booking.count.mockImplementation(({ where }) =>
			Promise.resolve(where.status.in.includes(status) ? 1 : 0),
		);
		await expect(handler.execute({ clientId: "c1" })).rejects.toThrow(ConflictException);
		expect(prisma.client.update).not.toHaveBeenCalled();
	});

	it("blocks when unpaid invoices exist", async () => {
		prisma.client.findFirst.mockResolvedValue({
			id: "c1",
			phone: "+966500000000",
			notes: "",
		});
		prisma.invoice.count.mockResolvedValue(1);
		await expect(handler.execute({ clientId: "c1" })).rejects.toThrow(
			"1 فاتورة",
		);
	});

	it("blocks when active program enrollments exist", async () => {
		prisma.client.findFirst.mockResolvedValue({
			id: "c1",
			phone: "+966500000000",
			notes: "",
		});
		prisma.programEnrollment.count.mockResolvedValue(3);
		await expect(handler.execute({ clientId: "c1" })).rejects.toThrow(
			"3 تسجيل",
		);
	});

	it("blocks when ratings exist", async () => {
		prisma.client.findFirst.mockResolvedValue({
			id: "c1",
			phone: "+966500000000",
			notes: "",
		});
		prisma.rating.count.mockResolvedValue(5);
		await expect(handler.execute({ clientId: "c1" })).rejects.toThrow(
			"5 تقييم",
		);
	});

	it("soft deletes client successfully", async () => {
		prisma.client.findFirst.mockResolvedValue({
			id: "c1",
			phone: "+966500000000",
			notes: "existing note",
		});
		await handler.execute({ clientId: "c1" });
		expect(rlsTransaction.withTransaction).toHaveBeenCalledWith(
			expect.any(Function),
			{ isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
		);
		expect(prisma.client.update).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					deletedAt: expect.any(Date),
					isActive: false,
					phone: null,
					notes: "existing note\n[deleted-phone:+966500000000]",
				}),
			}),
		);
	});

	it("soft deletes client without phone", async () => {
		prisma.client.findFirst.mockResolvedValue({
			id: "c1",
			phone: null,
			notes: "note",
		});
		await handler.execute({ clientId: "c1" });
		expect(prisma.client.update).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ notes: "note" }),
			}),
		);
	});
});
