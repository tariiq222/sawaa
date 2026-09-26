export function isDirectClinicBookingService(service: {
  isHidden: boolean
  category?: { bookingMode?: string } | null
}): boolean {
  return service.isHidden && service.category?.bookingMode === "DIRECT"
}
