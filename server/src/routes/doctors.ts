import { Router } from 'express'
import { getDoctor, getDoctorSlots, listDoctors } from '../controllers/doctors.js'
import { requireLogin, requireRole } from '../middleware/auth.js'

// Doctor directory and free slots: /api/doctors/*
export const doctorsRouter = Router()

doctorsRouter.use(requireLogin)

doctorsRouter.get('/', requireRole('patient'), listDoctors)
doctorsRouter.get('/:id', requireRole('patient'), getDoctor)
doctorsRouter.get('/:id/slots', getDoctorSlots)
