import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/database";

export type RemoveHolidayCommand = { holidayId: string };

// رسائل الحذف بالعربية — تُعرض للمستخدم النهائي عبر HttpExceptionFilter
const REMOVE_HOLIDAY_MESSAGES = {
	notFound: "العطلة الرسمية غير موجودة",
} as const;

@Injectable()
export class RemoveHolidayHandler {
	constructor(private readonly prisma: PrismaService) {}

	async execute(dto: RemoveHolidayCommand) {
		const holiday = await this.prisma.holiday.findFirst({
			where: { id: dto.holidayId },
		});
		if (!holiday) throw new NotFoundException(REMOVE_HOLIDAY_MESSAGES.notFound);

		await this.prisma.holiday.delete({ where: { id: dto.holidayId } });
		return { deleted: true };
	}
}
