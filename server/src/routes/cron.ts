import { Router } from 'express'
import { requireCronSecret, runReminders } from '../controllers/cron.js'

// Called once a day by cron-job.org, with no session: /api/cron/*
export const cronRouter = Router()

cronRouter.use(requireCronSecret)

cronRouter.post('/reminders', runReminders)
