/**
 * English translations — SMS settings and delivery log
 */

export const enSms: Record<string, string> = {
  // — Page —
  "sms.page.title": "SMS settings",
  "sms.page.description": "Choose your clinic's SMS provider and enter credentials.",

  // — Settings form —
  "sms.form.title": "SMS settings",
  "sms.form.loading": "Loading...",
  "sms.form.provider": "Provider",
  "sms.form.providerNone": "None",
  "sms.form.senderId": "Sender ID",
  "sms.form.credsHint": "Enter new credentials to save (will not be shown again)",
  "sms.form.save": "Save",
  "sms.form.credsSaved": "Credentials saved",
  "sms.form.testPhone": "Test phone",
  "sms.form.sendTest": "Send test",
  "sms.form.testSent": "Sent successfully ({id})",
  "sms.form.testFailed": "Failed",

  // — Delivery log —
  "sms.log.title": "Delivery log",
  "sms.log.loading": "Loading...",
  "sms.log.empty": "No messages sent yet",
  "sms.log.col.phone": "Phone",
  "sms.log.col.provider": "Provider",
  "sms.log.col.status": "Status",
  "sms.log.col.sent": "Sent",
  "sms.log.col.delivered": "Delivered",
}
