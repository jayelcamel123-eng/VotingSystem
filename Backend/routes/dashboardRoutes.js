const express = require('express')
const { getDashboardStats } = require('../controllers/dashboardController')
const { requireAuth, requireRole } = require('../middleware/authMiddleware')

const router = express.Router()

router.get('/stats', requireAuth, requireRole('admin'), getDashboardStats)

module.exports = router
