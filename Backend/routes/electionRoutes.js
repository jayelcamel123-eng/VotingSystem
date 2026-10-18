const express = require('express')
const c = require('../controllers/electionController')
const { requireAuth, requireRole } = require('../middleware/authMiddleware')

const router = express.Router()

router.get('/', requireAuth, c.getElections)
router.post('/', requireAuth, requireRole('admin'), c.createElection)
router.put('/:id', requireAuth, requireRole('admin'), c.updateElection)
router.delete('/:id', requireAuth, requireRole('admin'), c.deleteElection)
router.put('/:id/archive', requireAuth, requireRole('admin'), c.archiveElection)
router.put('/:id/restore', requireAuth, requireRole('admin'), c.restoreElection)

module.exports = router
