const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatConfirmTime(date: Date, isRTL: boolean): string {
  const hour = date.getHours();
  const minute = date.getMinutes();
  const suffix = hour < 12 ? (isRTL ? 'ص' : 'AM') : (isRTL ? 'م' : 'PM');
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

export function formatConfirmDate(date: Date, isRTL: boolean): string {
  const month = isRTL ? MONTHS_AR[date.getMonth()] : MONTHS_EN[date.getMonth()];
  const day = isRTL ? date.getDate().toLocaleString('ar-SA') : date.getDate();
  const year = isRTL ? date.getFullYear().toLocaleString('ar-SA') : date.getFullYear();
  return isRTL ? `${day} ${month} ${year}` : `${month} ${day}, ${year}`;
}
