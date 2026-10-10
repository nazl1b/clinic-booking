-- Reason for the visit. Required for new online and phone appointments (checked by
-- the API); left empty on appointments made before this column existed.
CREATE TYPE "visit_reason" AS ENUM ('first_visit', 'follow_up', 'check_up', 'test_results', 'other');

ALTER TABLE "appointments" ADD COLUMN "reason" "visit_reason";

-- Blocked time is not a visit, so it never has a reason.
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_reason_not_on_block" CHECK ("kind" <> 'block' OR "reason" IS NULL);
