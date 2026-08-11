import { Injectable } from "@nestjs/common";

export type WhatsappSpecialist =
  | "CONCIERGE"
  | "NEW_BOOKING"
  | "BOOKING_SUPPORT"
  | "HUMAN";

const TOOL_ACCESS: Record<WhatsappSpecialist, readonly string[]> = {
  CONCIERGE: ["listServices", "listCounselors", "checkAvailability"],
  NEW_BOOKING: [
    "listServices",
    "listCounselors",
    "checkAvailability",
    "proposeBooking",
  ],
  BOOKING_SUPPORT: ["lookupClient", "listMyBookings", "cancelBookingRequest"],
  HUMAN: [],
};

@Injectable()
export class SpecialistRegistryService {
  getToolNames(specialist: WhatsappSpecialist): readonly string[] {
    return TOOL_ACCESS[specialist];
  }

  route(text: string, current?: WhatsappSpecialist): WhatsappSpecialist {
    const value = text.toLocaleLowerCase("ar");
    if (/(موظف|موظفة|إنسان|انسان|شكوى|شكاي|complaint|human|staff)/i.test(value))
      return "HUMAN";
    if (
      /(إلغاء|الغاء|تعديل|تغيير الموعد|حجزي|حجز سابق|cancel|reschedul|booking)/i.test(
        value,
      )
    ) {
      return "BOOKING_SUPPORT";
    }
    if (/(احجز|حجز جديد|موعد|مواعيد|book|appointment|schedule)/i.test(value)) {
      return "NEW_BOOKING";
    }
    if (current && current !== "HUMAN") return current;
    return "CONCIERGE";
  }

  prompt(specialist: WhatsappSpecialist): string {
    switch (specialist) {
      case "NEW_BOOKING":
        return "أنت موظف استقبال يساعد العميل على الحجز خطوة بخطوة. ابدأ بفهم الخدمة المطلوبة، ثم ساعده في اختيار المستشار والموعد. إذا طلب اسماً غير موجود، قل ذلك بوضوح واعرض أسماء المستشارين المتاحين فقط. استخدم proposeBooking بعد اكتمال البيانات، وقدّم الملخص بصياغة بشرية قصيرة، ولا تقل إن الحجز تم قبل تأكيد العميل برسالة لاحقة.";
      case "BOOKING_SUPPORT":
        return "أنت موظف استقبال يتابع الحجوزات السابقة. اعرض الحجوزات المرتبطة برقم واتساب فقط، وتحدث بلطف عند طلب الإلغاء أو التعديل، ثم سجّل الطلب للموظف دون تنفيذ العملية.";
      case "HUMAN":
        return "اطلب من العميل الانتظار بهدوء وبعبارة قصيرة، وأكد أن موظفاً من المركز سيتابع معه. لا تستخدم أي أداة.";
      default:
        return "أنت موظف استقبال يعرّف العميل بخدمات المركز. استخدم الأدوات لمعرفة الخدمات والمستشارين والتوفر، وقدّم خياراً أو خيارين واضحين ثم اسأل ما الذي يناسبه. إذا ذكر العميل مستشاراً بالاسم، تحقق من قائمة المستشارين قبل الرد ولا تحوّل السؤال إلى قائمة خدمات. حوّل الحوار لوكيل الحجز عند إبداء رغبة واضحة بالحجز.";
    }
  }
}
