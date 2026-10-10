// Appointment lists of the patient, the doctor and the admin: search, filters
// and one page, all done in the database.
import { prisma } from '../db.js'
import type { Prisma } from '../generated/prisma/client.js'
import { type AppointmentListQuery, MY_PAGE_SIZE, type MyAppointmentsQuery } from '../schemas/appointments.js'
import { DEFAULT_PAGE_SIZE } from '../schemas/common.js'
import { appointmentInclude, toAppointmentJson } from '../serializers.js'
import { dateToDb } from '../utils/dates.js'
import { escapeLike } from '../utils/search.js'
import { upcomingWhere } from './appointments.js'

// One page of the appointments that match `where`, plus how many match in total.
// `id` is the last sort key, so the pages join without gaps or repeats.
async function findPage(where: Prisma.AppointmentWhereInput, direction: Prisma.SortOrder, page: number, pageSize: number) {
  const [total, rows] = await prisma.$transaction([
    prisma.appointment.count({ where }),
    prisma.appointment.findMany({
      where,
      orderBy: [{ date: direction }, { time: direction }, { id: direction }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: appointmentInclude,
    }),
  ])
  return { items: rows.map(toAppointmentJson), page, pageSize, total }
}

// Patient name or email (online), guest name or phone (manual).
// Phone numbers also match by digits only, so "6941234567" finds "+30 694 123 4567".
async function searchWhere(search: string, doctorId: number | undefined): Promise<Prisma.AppointmentWhereInput> {
  const text = escapeLike(search)
  const OR: Prisma.AppointmentWhereInput[] = [
    { patient: { name: { contains: text, mode: 'insensitive' } } },
    { patient: { email: { contains: text, mode: 'insensitive' } } },
    { guestName: { contains: text, mode: 'insensitive' } },
    { guestPhone: { contains: text } },
  ]
  const digits = search.replace(/\D/g, '')
  if (digits.length >= 3) {
    const rows = await prisma.$queryRaw<{ id: number }[]>`
      SELECT id FROM appointments
      WHERE guest_phone IS NOT NULL
        AND regexp_replace(guest_phone, '[^0-9]', '', 'g') LIKE ${`%${digits}%`}
        AND (${doctorId ?? null}::int IS NULL OR doctor_id = ${doctorId ?? null}::int)`
    if (rows.length > 0) OR.push({ id: { in: rows.map((r) => r.id) } })
  }
  return { OR }
}

// scope.doctorId: a doctor only ever sees their own schedule, whatever they send.
export async function listAppointments(query: AppointmentListQuery, scope: { doctorId?: number } = {}) {
  const doctorId = scope.doctorId ?? query.doctor
  const page = query.page ?? 1
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE

  const filters: Prisma.AppointmentWhereInput[] = []
  if (doctorId !== undefined) filters.push({ doctorId })
  if (query.status) filters.push({ status: query.status })
  if (query.kind) filters.push({ kind: query.kind })
  if (query.from) filters.push({ date: { gte: dateToDb(query.from) } })
  if (query.to) filters.push({ date: { lte: dateToDb(query.to) } })
  if (query.search) filters.push(await searchWhere(query.search, doctorId))
  return findPage({ AND: filters }, 'asc', page, pageSize)
}

// The patient's own appointments. Upcoming ones come soonest first; past and
// cancelled ones most recent first.
export async function listPatientAppointments(patientId: number, query: MyAppointmentsQuery) {
  const upcoming: Prisma.AppointmentWhereInput = { AND: [{ status: 'active' }, upcomingWhere()] }
  const where: Prisma.AppointmentWhereInput = { AND: [{ patientId }, query.view === 'upcoming' ? upcoming : { NOT: upcoming }] }
  return findPage(where, query.view === 'upcoming' ? 'asc' : 'desc', query.page ?? 1, query.pageSize ?? MY_PAGE_SIZE)
}
