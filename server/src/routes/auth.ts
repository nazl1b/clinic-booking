import { Router } from 'express'
import { login, logout, me, register } from '../controllers/auth.js'
import { requireLogin } from '../middleware/auth.js'
import { loginLimiter, registerLimiter } from '../middleware/rateLimit.js'

export const authRouter = Router()

authRouter.post('/register', registerLimiter, register)
authRouter.post('/login', loginLimiter, login)
authRouter.post('/logout', logout)
authRouter.get('/me', requireLogin, me)
