const express = require('express');
const {
    getRecentActivity
} = require('../controllers/activityController');

const {
    requireAuth,
    requireRole
} = require('../middleware/authMiddleware');

const router = express.Router();

router.get(
    '/',
    requireAuth,
    requireRole('admin'),
    getRecentActivity
);

module.exports = router;