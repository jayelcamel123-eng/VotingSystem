const pool = require('../config/db')

async function getPositions(req, res) {
  try {
    const r = await pool.query(
      'SELECT position_id,position_name FROM positions WHERE archived_at IS NULL ORDER BY position_id'
    )
    res.json({ success: true, positions: r.rows })
  } catch (e) {
    console.error(e)
    res.status(500).json({ success: false, message: 'Failed to load positions.' })
  }
}

module.exports = { getPositions }
