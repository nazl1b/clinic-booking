import { Router } from 'express'
import { bookAppointment } from '../controllers/appointments.js'
import { requireLogin, requireRole } from '../middleware/auth.js'

// Patient appointments: /api/appointments/*
export const appointmentsRouter = Router()

appointmentsRouter.use(requireLogin, requireRole('patient'))

appointmentsRouter.post('/', bookAppointment)
