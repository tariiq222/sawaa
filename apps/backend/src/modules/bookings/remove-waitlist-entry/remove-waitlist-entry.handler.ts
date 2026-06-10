import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/database";

export interface RemoveWaitlistEntryCommand {
	id: string;
}

// رسائل الحذف بالعربية — تُعرض للمستخدم النهائي عبر HttpExceptionFilter
const REMOVE_WAITLIST_MESSAGES = {
	notFound: (id: string) => `طلب قائمة الانتظار رقم ${id} غير موجود`,
} as const;

@Injectable()
export class RemoveWaitlistEntryHandler {
	constructor(private readonly prisma: PrismaService) {}

	async execute(cmd: RemoveWaitlistEntryCommand): Promise<void> {
		const { count } = await this.prisma.waitlistEntry.deleteMany({
			where: { id: cmd.id },
		});
		if (count === 0)
			throw new NotFoundException(REMOVE_WAITLIST_MESSAGES.notFound(cmd.id));
	}
}
