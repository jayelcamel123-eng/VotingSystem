const express = require('express')
const { login, logout, heartbeat } = require('../controllers/authController')
const { requireAuth } = require('../middleware/authMiddleware')

const router = express.Router()

router.post('/login', login)
router.post('/heartbeat', requireAuth, heartbeat)
router.post('/logout', requireAuth, logout)
router.get('/me', requireAuth, (req, res) =>
  res.json({ success: true, user: req.auth.user, voter: req.auth.voter })
)

module.exports = router
