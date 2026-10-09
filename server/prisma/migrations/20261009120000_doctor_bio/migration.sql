-- Short text about a doctor, shown to patients on the doctor's page. Optional.
ALTER TABLE "users" ADD COLUMN "bio" TEXT;

-- Only doctors have a bio, like the specialty. The length limit is checked by the API.
ALTER TABLE "users" ADD CONSTRAINT "users_bio_doctor_only" CHECK ("bio" IS NULL OR "role" = 'doctor');
