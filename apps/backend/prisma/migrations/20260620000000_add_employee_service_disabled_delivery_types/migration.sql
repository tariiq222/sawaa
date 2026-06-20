-- Per-practitioner delivery-type opt-out within a service.
-- Empty array (default) preserves prior behavior: the practitioner offers every
-- delivery type the service has an active ServiceBookingConfig for.
ALTER TABLE "EmployeeService" ADD COLUMN "disabledDeliveryTypes" "DeliveryType"[] NOT NULL DEFAULT ARRAY[]::"DeliveryType"[];
