import {
	Injectable,
	NotFoundException,
	BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/database";

export interface DeleteCouponCommand {
	couponId: string;
}

// رسائل الحذف بالعربية — تُعرض للمستخدم النهائي عبر HttpExceptionFilter
const DELETE_COUPON_MESSAGES = {
	notFound: "الكوبون غير موجود",
	hasRedemptions: "لا يمكن حذف الكوبون لوجود عمليات استخدام مسجلة له",
} as const;

@Injectable()
export class DeleteCouponHandler {
	constructor(private readonly prisma: PrismaService) {}

	async execute(cmd: DeleteCouponCommand): Promise<void> {
		const [coupon, redemptionCount] = await Promise.all([
			this.prisma.coupon.findFirst({ where: { id: cmd.couponId } }),
			this.prisma.couponRedemption.count({ where: { couponId: cmd.couponId } }),
		]);
		if (!coupon) throw new NotFoundException(DELETE_COUPON_MESSAGES.notFound);
		if (redemptionCount > 0) {
			throw new BadRequestException(DELETE_COUPON_MESSAGES.hasRedemptions);
		}
		await this.prisma.coupon.delete({ where: { id: cmd.couponId } });
	}
}
