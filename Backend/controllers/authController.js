const bcrypt = require('bcrypt')
const pool = require('../config/db')
const {
  createSession,
  revokeSession,
  isAdminSessionActive,
} = require('../middleware/authMiddleware')

async function login(req, res) {
  try {
    const username = String(req.body?.username || '').trim()
    const password = String(req.body?.password || '')
    if (!username || !password)
      return res
        .status(400)
        .json({ success: false, message: 'Username and password are required.' })

    const result = await pool.query(
      `
            SELECT l.login_id, l.user_id, l.username, l.password_hash, l.account_status, u.role
            FROM login l JOIN users u ON u.user_id = l.user_id
            WHERE l.username = $1
        `,
      [username]
    )

    if (!result.rows.length) {
      await pool.query(
        `INSERT INTO activity_logs
                (activity_type, description, user_name, status)
                VALUES ($1, $2, $3, $4)`,
        ['Voter login', `Failed login attempt for voter ${username}`, username, 'Failed']
      )

      return res.status(401).json({ success: false, message: 'Invalid username or password.' })
    }

    const account = result.rows[0]
    if (account.account_status !== 'active')
      return res
        .status(403)
        .json({ success: false, message: `Account is ${account.account_status}.` })

    if (account.role === 'admin' && isAdminSessionActive()) {
      await pool.query(
        `INSERT INTO activity_logs
                (activity_type, description, user_name, status)
                VALUES ($1, $2, $3, $4)`,
        [
          'Admin login',
          `Admin ${account.username} attempted to log in while another admin session was already active`,
          account.username,
          'Failed',
        ]
      )

      return res.status(409).json({
        success: false,
        message: 'Admin account is already logged in on another session.',
      })
    }

    if (!(await bcrypt.compare(password, account.password_hash))) {
      if (account.role === 'voter') {
        const voterResult = await pool.query(
          `
                    SELECT name
                    FROM voters
                    WHERE user_id = $1
                     AND archived_at IS NULL
                `,
          [account.user_id]
        )

        const voterName = voterResult.rows[0]?.name || account.username

        await pool.query(
          `INSERT INTO activity_logs
                    (activity_type, description, user_name, status)
                    VALUES ($1, $2, $3, $4)`,
          ['Voter login', `Failed login attempt for voter ${voterName}`, voterName, 'Failed']
        )
      }

      return res.status(401).json({ success: false, message: 'Invalid username or password.' })
    }

    let voter = null
    if (account.role === 'voter') {
      const voterResult = await pool.query(
        `
                SELECT voter_id, user_id, name, grade, section, status, voting_status
                FROM voters WHERE user_id = $1 AND archived_at IS NULL
            `,
        [account.user_id]
      )
      voter = voterResult.rows[0] || null
      if (!voter || voter.status !== 'active')
        return res
          .status(403)
          .json({ success: false, message: 'This voter account is not active.' })
    }

    await pool.query('UPDATE login SET last_login = CURRENT_TIMESTAMP WHERE login_id = $1', [
      account.login_id,
    ])

    const user = { user_id: account.user_id, username: account.username, role: account.role }
    const token = createSession(user, voter)

    res.cookie('authToken', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 8 * 60 * 60 * 1000,
    })

    if (account.role === 'voter') {
      await pool.query(
        `INSERT INTO activity_logs
                (activity_type, description, user_name, status)
                VALUES ($1, $2, $3, $4)`,
        ['Voter login', `Voter ${voter.name} logged in successfully`, voter.name, 'Success']
      )
    }

    if (account.role === 'admin') {
      await pool.query(
        `INSERT INTO activity_logs
                (activity_type, description, user_name, status)
                VALUES ($1, $2, $3, $4)`,
        [
          'Admin login',
          `Administrator ${account.username} logged in successfully`,
          account.username,
          'Success',
        ]
      )
    }

    res.json({ success: true, message: 'Login successful.', token, user, voter })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ success: false, message: 'Server error during login.' })
  }
}

function logout(req, res) {
  revokeSession(req.authToken)
  res.clearCookie('authToken', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
  res.json({ success: true, message: 'Logged out successfully.' })
}

function heartbeat(req, res) {
  res.json({
    success: true,
    message: 'Session is active.',
  })
}

module.exports = { login, logout, heartbeat }
