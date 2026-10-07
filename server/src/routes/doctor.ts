import { Router } from 'express'
import { getMyAvailability, saveMyAvailability } from '../controllers/availability.js'
import { requireLogin, requireRole } from '../middleware/auth.js'

// Endpoints for the logged-in doctor: /api/doctor/*
export const doctorRouter = Router()

doctorRouter.use(requireLogin, requireRole('doctor'))

doctorRouter.get('/availability', getMyAvailability)
doctorRouter.put('/availability', saveMyAvailability)
