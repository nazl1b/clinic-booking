import { Router } from 'express'
import { login, logout, me, register } from '../controllers/auth.js'
import { changePassword, forgotPassword, resetPassword } from '../controllers/password.js'
import { requireLogin } from '../middleware/auth.js'
import { changePasswordLimiter, forgotPasswordLimiter, loginLimiter, registerLimiter } from '../middleware/rateLimit.js'

export const authRouter = Router()

authRouter.post('/register', registerLimiter, register)
authRouter.post('/login', loginLimiter, login)
authRouter.post('/logout', logout)
authRouter.get('/me', requireLogin, me)

authRouter.post('/forgot-password', forgotPasswordLimiter, forgotPassword)
authRouter.post('/reset-password', resetPassword)
authRouter.patch('/password', requireLogin, changePasswordLimiter, changePassword)
