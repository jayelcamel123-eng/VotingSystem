const express = require('express');
const { castVote, getBallot } = require('../controllers/voteController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.get(
    '/ballot/:voterId',
    requireAuth,
    requireRole('voter'),
    getBallot
);

router.post(
    '/cast',
    requireAuth,
    requireRole('voter'),
    castVote
);

module.exports = router;