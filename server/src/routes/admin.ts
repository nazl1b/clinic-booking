import { Router } from 'express'
import {
  cancelAnyAppointment,
  createAdminAppointment,
  getSpecialties,
  getUpcomingCount,
  listAllAppointments,
  listAllDoctors,
  updateDoctor,
} from '../controllers/admin.js'
import { createInvitation, deleteInvitation, listInvitations, resendInvitation } from '../controllers/invitations.js'
import { requireLogin, requireRole } from '../middleware/auth.js'

// Admin endpoints: /api/admin/*
export const adminRouter = Router()

adminRouter.use(requireLogin, requireRole('admin'))

adminRouter.get('/doctors', listAllDoctors)
adminRouter.get('/doctors/:id/upcoming-count', getUpcomingCount)
adminRouter.patch('/doctors/:id', updateDoctor)
adminRouter.get('/specialties', getSpecialties)

adminRouter.post('/invitations', createInvitation)
adminRouter.get('/invitations', listInvitations)
adminRouter.post('/invitations/:id/resend', resendInvitation)
adminRouter.delete('/invitations/:id', deleteInvitation)

adminRouter.get('/appointments', listAllAppointments)
adminRouter.post('/appointments', createAdminAppointment)
adminRouter.patch('/appointments/:id/cancel', cancelAnyAppointment)
