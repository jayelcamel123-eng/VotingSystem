const crypto = require('crypto');

const sessions = new Map();

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

// Admin must send a heartbeat periodically.
// If the browser is closed, the heartbeat stops and
// the admin session is released automatically.
const ADMIN_IDLE_TIMEOUT_MS = 60 * 1000;

// Stores the currently active admin session token.
// Only one admin session is allowed at a time.
let activeAdminSessionToken = null;


function createSession(user, voter = null) {
    const token = crypto.randomBytes(32).toString('hex');

    sessions.set(token, {
        user,
        voter,
        expiresAt: Date.now() + SESSION_TTL_MS,
        lastSeenAt: Date.now()
    });

    // If this is an admin session, make it the only active admin session.
    if (user.role === 'admin') {
        activeAdminSessionToken = token;
    }

    return token;
}


function getSession(token) {
    if (!token) return null;

    const session = sessions.get(token);

    if (!session) return null;

    // Normal session expiration
    if (session.expiresAt < Date.now()) {
        sessions.delete(token);

        if (token === activeAdminSessionToken) {
            activeAdminSessionToken = null;
        }

        return null;
    }

    return session;
}


function touchSession(token) {
    if (!token) return null;

    const session = sessions.get(token);

    if (!session) return null;

    session.lastSeenAt = Date.now();

    return session;
}


function revokeSession(token) {
    if (!token) return;

    sessions.delete(token);

    // Release admin lock when the admin logs out.
    if (token === activeAdminSessionToken) {
        activeAdminSessionToken = null;
    }
}


function isAdminSessionActive() {
    if (!activeAdminSessionToken) {
        return false;
    }

    const session = sessions.get(activeAdminSessionToken);

    if (!session || session.user.role !== 'admin') {
        activeAdminSessionToken = null;
        return false;
    }

    // Normal session expiration
    if (session.expiresAt < Date.now()) {
        sessions.delete(activeAdminSessionToken);
        activeAdminSessionToken = null;
        return false;
    }

    // Admin browser has stopped sending heartbeats.
    if (Date.now() - session.lastSeenAt > ADMIN_IDLE_TIMEOUT_MS) {
        sessions.delete(activeAdminSessionToken);
        activeAdminSessionToken = null;
        return false;
    }

    return true;
}


function requireAuth(req, res, next) {
    const header = req.headers.authorization || '';

    const token = header.startsWith('Bearer ')
        ? header.slice(7)
        : null;

    const session = getSession(token);

    if (!session) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required or session expired.'
        });
    }

    // Keep the session alive whenever the authenticated
    // user makes a normal API request.
    touchSession(token);

    req.auth = session;
    req.authToken = token;

    next();
}


function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.auth || !roles.includes(req.auth.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to perform this action.'
            });
        }

        next();
    };
}


module.exports = {
    createSession,
    getSession,
    touchSession,
    revokeSession,
    isAdminSessionActive,
    requireAuth,
    requireRole
};