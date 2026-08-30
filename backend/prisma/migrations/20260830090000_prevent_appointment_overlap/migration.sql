-- Additive concurrency guard: blocking appointments for one employee may not overlap.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Appointment"
ADD CONSTRAINT "Appointment_employee_blocking_time_excl"
EXCLUDE USING gist (
  "employeeId" WITH =,
  tsrange("startAt", "endAt", '[)') WITH &&
)
WHERE ("status" IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS'));
