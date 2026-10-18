const express = require('express')
const c = require('../controllers/candidateController')
const { requireAuth, requireRole } = require('../middleware/authMiddleware')

const router = express.Router()

router.get('/', requireAuth, c.getCandidates)
router.post('/', requireAuth, requireRole('admin'), c.createCandidate)
router.put('/:id', requireAuth, requireRole('admin'), c.updateCandidate)
router.delete('/:id', requireAuth, requireRole('admin'), c.deleteCandidate)
router.put('/:id/archive', requireAuth, requireRole('admin'), c.archiveCandidate)
router.put('/:id/restore', requireAuth, requireRole('admin'), c.restoreCandidate)

module.exports = router
