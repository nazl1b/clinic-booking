// Appointment lists of the doctor and the admin: search, filters and one page,
// all done in the database (ARCHITECTURE.md section 10).
import { prisma } from '../db.js'
import type { Prisma } from '../generated/prisma/client.js'
import { type AppointmentListQuery, DEFAULT_PAGE_SIZE } from '../schemas/appointments.js'
import { appointmentInclude, toAppointmentJson } from '../serializers.js'
import { dateToDb } from '../utils/dates.js'

// Prisma's `contains` becomes LIKE '%…%' without escaping, so "%" or "_" typed
// by the user would match everything. Backslash is LIKE's escape character in Postgres.
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
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
  const where: Prisma.AppointmentWhereInput = { AND: filters }

  const [total, rows] = await prisma.$transaction([
    prisma.appointment.count({ where }),
    prisma.appointment.findMany({
      where,
      orderBy: [{ date: 'asc' }, { time: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: appointmentInclude,
    }),
  ])
  return { items: rows.map(toAppointmentJson), page, pageSize, total }
}
