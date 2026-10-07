// Deactivating a doctor.
import { prisma } from '../db.js'
import { HttpError } from '../errors.js'
import { deleteUserSessions } from '../session.js'
import { dateFromDb, timeFromDb } from '../utils/dates.js'
import { notifyCancellation, upcomingWhere } from './appointments.js'

const DEACTIVATION_REASON = 'The doctor is no longer available at the clinic.'

// The doctor is never deleted, so the history of their appointments stays.
//  1. In one transaction: the doctor becomes inactive and every upcoming active
//     appointment is cancelled (blocks too). Updating the doctor's row waits for
//     bookings in progress (they hold it FOR SHARE), so they are cancelled as well.
//  2. Every session of the doctor is deleted: logged out at once.
//  3. Patients of online appointments are emailed.
// Returns what the admin sees: how many appointments were cancelled (blocks not
// counted), how many patients were emailed, and the phone appointments to call.
export async function deactivateDoctor(doctorId: number) {
  const cancelled = await prisma.$transaction(async (tx) => {
    const { count } = await tx.user.updateMany({ where: { id: doctorId, role: 'doctor', isActive: true }, data: { isActive: false } })
    if (count === 0) return null
    const upcoming = await tx.appointment.findMany({
      where: { AND: [{ doctorId, status: 'active' }, upcomingWhere()] },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
    })
    await tx.appointment.updateMany({ where: { id: { in: upcoming.map((a) => a.id) } }, data: { status: 'cancelled' } })
    return upcoming
  })
  if (!cancelled) throw new HttpError(400, 'This doctor is already deactivated.')

  await deleteUserSessions(doctorId)

  // A failed email is logged; the appointment stays cancelled either way.
  const results = await Promise.allSettled(
    cancelled.filter((a) => a.kind === 'online').map((a) => notifyCancellation(a.id, DEACTIVATION_REASON)),
  )
  for (const result of results) {
    if (result.status === 'rejected') console.error('Deactivation email failed:', result.reason)
  }

  return {
    cancelledCount: cancelled.filter((a) => a.kind !== 'block').length,
    emailedCount: results.filter((r) => r.status === 'fulfilled' && r.value).length,
    phoneContacts: cancelled
      .filter((a) => a.kind === 'manual')
      .map((a) => ({
        appointmentId: a.id,
        guestName: a.guestName ?? '',
        guestPhone: a.guestPhone ?? '',
        date: dateFromDb(a.date),
        time: timeFromDb(a.time),
      })),
  }
}
