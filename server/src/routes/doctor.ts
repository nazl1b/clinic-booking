import { Router } from 'express'
import { getMyAvailability, saveMyAvailability } from '../controllers/availability.js'
import { cancelMyScheduleAppointment, createMyScheduleAppointment, listMyScheduleAppointments } from '../controllers/doctorAppointments.js'
import { updateMyProfile } from '../controllers/doctorProfile.js'
import { requireLogin, requireRole } from '../middleware/auth.js'

// Endpoints for the logged-in doctor: /api/doctor/*
export const doctorRouter = Router()

doctorRouter.use(requireLogin, requireRole('doctor'))

doctorRouter.patch('/profile', updateMyProfile)

doctorRouter.get('/availability', getMyAvailability)
doctorRouter.put('/availability', saveMyAvailability)

doctorRouter.get('/appointments', listMyScheduleAppointments)
doctorRouter.post('/appointments', createMyScheduleAppointment)
doctorRouter.patch('/appointments/:id/cancel', cancelMyScheduleAppointment)
