import { Test } from "@nestjs/testing";
import { NotFoundException, ConflictException } from "@nestjs/common";
import { DeleteClientHandler } from "./delete-client.handler";
import { PrismaService } from "../../../infrastructure/database";

describe("DeleteClientHandler", () => {
	let handler: DeleteClientHandler;
	let prisma: {
		client: { findFirst: jest.Mock; update: jest.Mock };
		booking: { count: jest.Mock };
		invoice: { count: jest.Mock };
		groupEnrollment: { count: jest.Mock };
		rating: { count: jest.Mock };
	};

	beforeEach(async () => {
		prisma = {
			client: { findFirst: jest.fn(), update: jest.fn().mockResolvedValue({}) },
			booking: { count: jest.fn().mockResolvedValue(0) },
			invoice: { count: jest.fn().mockResolvedValue(0) },
			groupEnrollment: { count: jest.fn().mockResolvedValue(0) },
			rating: { count: jest.fn().mockResolvedValue(0) },
		};

		const module = await Test.createTestingModule({
			providers: [
				DeleteClientHandler,
				{ provide: PrismaService, useValue: prisma },
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

	it("blocks when active group enrollments exist", async () => {
		prisma.client.findFirst.mockResolvedValue({
			id: "c1",
			phone: "+966500000000",
			notes: "",
		});
		prisma.groupEnrollment.count.mockResolvedValue(3);
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
