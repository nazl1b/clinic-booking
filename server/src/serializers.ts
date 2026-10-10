// Database rows → JSON shapes of the API (client/src/types).
import type { Prisma, User } from './generated/prisma/client.js'
import { dateFromDb, timeFromDb } from './utils/dates.js'

export function toDoctorJson(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    specialty: user.specialty ?? '',
    bio: user.bio, // null = no bio
    isActive: user.isActive,
  }
}

// Load appointments with this include to get the names toAppointmentJson needs.
export const appointmentInclude = {
  doctor: { select: { name: true, specialty: true } },
  patient: { select: { name: true } },
} satisfies Prisma.AppointmentInclude

type AppointmentWithNames = Prisma.AppointmentGetPayload<{ include: typeof appointmentInclude }>

export function toAppointmentJson(a: AppointmentWithNames) {
  return {
    id: a.id,
    doctorId: a.doctorId,
    doctorName: a.doctor.name,
    doctorSpecialty: a.doctor.specialty ?? '',
    kind: a.kind,
    patientId: a.patientId,
    patientName: a.patient?.name ?? null,
    guestName: a.guestName,
    guestPhone: a.guestPhone,
    reason: a.reason, // null on blocks and on appointments made before reasons existed
    note: a.note,
    date: dateFromDb(a.date),
    time: timeFromDb(a.time),
    durationMinutes: a.durationMinutes,
    status: a.status,
    createdAt: a.createdAt.toISOString(),
  }
}
