import { Router } from 'express'
import { bookAppointment, cancelMyAppointment, getMyAppointments } from '../controllers/appointments.js'
import { requireLogin, requireRole } from '../middleware/auth.js'

// Patient appointments: /api/appointments/*
export const appointmentsRouter = Router()

appointmentsRouter.use(requireLogin, requireRole('patient'))

appointmentsRouter.post('/', bookAppointment)
appointmentsRouter.get('/mine', getMyAppointments)
appointmentsRouter.patch('/:id/cancel', cancelMyAppointment)
