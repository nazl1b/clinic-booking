-- CreateEnum
CREATE TYPE "role" AS ENUM ('patient', 'doctor', 'admin');

-- CreateEnum
CREATE TYPE "appointment_kind" AS ENUM ('online', 'manual', 'block');

-- CreateEnum
CREATE TYPE "appointment_status" AS ENUM ('active', 'cancelled');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "role" NOT NULL,
    "specialty" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "invited_by" INTEGER NOT NULL,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_resets" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability" (
    "id" SERIAL NOT NULL,
    "doctor_id" INTEGER NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TIME(0) NOT NULL,
    "end_time" TIME(0) NOT NULL,
    "slot_minutes" INTEGER NOT NULL,

    CONSTRAINT "availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" SERIAL NOT NULL,
    "doctor_id" INTEGER NOT NULL,
    "kind" "appointment_kind" NOT NULL,
    "patient_id" INTEGER,
    "guest_name" TEXT,
    "guest_phone" TEXT,
    "note" TEXT,
    "created_by" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "time" TIME(0) NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "status" "appointment_status" NOT NULL DEFAULT 'active',
    "reminder_sent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "sid" VARCHAR NOT NULL,
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations"("token_hash");

-- CreateIndex
CREATE INDEX "invitations_email_idx" ON "invitations"("email");

-- CreateIndex
CREATE UNIQUE INDEX "password_resets_token_hash_key" ON "password_resets"("token_hash");

-- CreateIndex
CREATE INDEX "password_resets_user_id_idx" ON "password_resets"("user_id");

-- CreateIndex
CREATE INDEX "availability_doctor_id_idx" ON "availability"("doctor_id");

-- CreateIndex
CREATE INDEX "appointments_doctor_id_date_idx" ON "appointments"("doctor_id", "date");

-- CreateIndex
CREATE INDEX "appointments_patient_id_idx" ON "appointments"("patient_id");

-- CreateIndex
CREATE INDEX "appointments_date_idx" ON "appointments"("date");

-- CreateIndex
CREATE UNIQUE INDEX "one_active_per_slot" ON "appointments"("doctor_id", "date", "time") WHERE (status = 'active');

-- CreateIndex
CREATE INDEX "IDX_session_expire" ON "session"("expire");

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability" ADD CONSTRAINT "availability_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECK constraints. Not expressible in schema.prisma, so they are written here by hand.
-- Prisma Migrate leaves them alone in later migrations.

-- Emails are always stored lowercase.
ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase" CHECK ("email" = lower("email"));
-- Doctors have a specialty, everyone else has none.
ALTER TABLE "users" ADD CONSTRAINT "users_specialty_doctor_only" CHECK (("role" = 'doctor') = ("specialty" IS NOT NULL));

ALTER TABLE "availability" ADD CONSTRAINT "availability_day_of_week_range" CHECK ("day_of_week" BETWEEN 0 AND 6);
ALTER TABLE "availability" ADD CONSTRAINT "availability_start_before_end" CHECK ("start_time" < "end_time");
ALTER TABLE "availability" ADD CONSTRAINT "availability_slot_minutes_positive" CHECK ("slot_minutes" > 0);

ALTER TABLE "appointments" ADD CONSTRAINT "appointments_duration_positive" CHECK ("duration_minutes" > 0);
-- Each kind has exactly the fields it needs:
--   online: a patient with an account, no guest details
--   manual: a guest name and phone, no patient account
--   block:  no patient at all
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_kind_fields" CHECK (
  ("kind" = 'online' AND "patient_id" IS NOT NULL AND "guest_name" IS NULL AND "guest_phone" IS NULL)
  OR ("kind" = 'manual' AND "patient_id" IS NULL AND "guest_name" IS NOT NULL AND "guest_phone" IS NOT NULL)
  OR ("kind" = 'block' AND "patient_id" IS NULL AND "guest_name" IS NULL AND "guest_phone" IS NULL)
);
