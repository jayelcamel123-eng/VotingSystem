const express = require('express')
const c = require('../controllers/voterController')
const { requireAuth, requireRole } = require('../middleware/authMiddleware')

const router = express.Router()

router.get('/', requireAuth, requireRole('admin'), c.getVoters)
router.get('/:id', requireAuth, c.getVoterById)
router.post('/', requireAuth, requireRole('admin'), c.createVoter)
router.put('/:id', requireAuth, requireRole('admin'), c.updateVoter)
router.delete('/:id', requireAuth, requireRole('admin'), c.deleteVoter)
router.put('/:id/archive', requireAuth, requireRole('admin'), c.archiveVoter)
router.put('/:id/restore', requireAuth, requireRole('admin'), c.restoreVoter)

module.exports = router
