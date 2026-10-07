// Phone appointments (manual) and blocked time (block), created by a doctor in
// their own schedule or by an admin for any doctor. They use the same free slots
// and the same lock as online bookings (services/slots.ts).
import { HttpError } from '../errors.js'
import type { StaffAppointmentInput } from '../schemas/appointments.js'
import { appointmentInclude } from '../serializers.js'
import { dateToDb, timeToDb } from '../utils/dates.js'
import { checkBlock, findSlot, inDoctorDayTransaction, lockActiveDoctor, SLOT_NOT_AVAILABLE, SLOT_TAKEN } from './slots.js'

const BLOCK_NOT_AVAILABLE = 'This period is outside working hours or in the past.'
const BLOCK_TAKEN = 'This period overlaps an appointment. Please choose another time.'

// manual: must be one of the doctor's free slots; its length comes from the working hours.
// block:  may be longer than one slot, but inside one working window, upcoming and
//         without overlapping an active appointment.
// 409 when the time is part of the working hours but taken, 400 for anything else.
export function createStaffAppointment(input: StaffAppointmentInput, doctorId: number, createdBy: number) {
  return inDoctorDayTransaction(doctorId, input.date, async (tx) => {
    const doctorIsActive = await lockActiveDoctor(tx, doctorId)
    const common = { doctorId, createdBy, date: dateToDb(input.date), time: timeToDb(input.time), note: input.note }

    if (input.kind === 'manual') {
      const slot = doctorIsActive ? await findSlot(tx, doctorId, input.date, input.time) : undefined
      if (!slot) throw new HttpError(400, SLOT_NOT_AVAILABLE)
      if (!slot.free) throw new HttpError(409, SLOT_TAKEN)
      return tx.appointment.create({
        data: { ...common, kind: 'manual', guestName: input.guestName, guestPhone: input.guestPhone, durationMinutes: slot.durationMinutes },
        include: appointmentInclude,
      })
    }

    const check = doctorIsActive ? await checkBlock(tx, doctorId, input.date, input.time, input.durationMinutes) : 'unavailable'
    if (check === 'unavailable') throw new HttpError(400, BLOCK_NOT_AVAILABLE)
    if (check === 'taken') throw new HttpError(409, BLOCK_TAKEN)
    return tx.appointment.create({
      data: { ...common, kind: 'block', durationMinutes: input.durationMinutes },
      include: appointmentInclude,
    })
  })
}
