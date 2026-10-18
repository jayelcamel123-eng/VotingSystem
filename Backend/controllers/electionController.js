const pool = require('../config/db')
const { normalizeText, validateElectionDates } = require('../utils/validators')

function dates(body) {
  const name = normalizeText(body?.election_name)
  const description = normalizeText(body?.description)

  if (!name)
    throw Object.assign(new Error('Election name is required.'), {
      status: 400,
    })

  const { start, end } = validateElectionDates(body?.start_date, body?.end_date)

  return { name, description, start, end }
}

async function getElections(req, res) {
  try {
    const archived = String(req.query.archived || 'false') === 'true'
    const r = await pool.query(
      `SELECT e.*, CASE WHEN e.status='cancelled' THEN 'cancelled' WHEN e.archived_at IS NOT NULL THEN 'cancelled' WHEN CURRENT_TIMESTAMP < e.start_date THEN 'upcoming' WHEN CURRENT_TIMESTAMP BETWEEN e.start_date AND e.end_date THEN 'ongoing' ELSE 'ended' END AS effective_status, (SELECT COUNT(*)::int FROM candidates c WHERE c.election_id=e.election_id AND c.archived_at IS NULL) AS candidate_count FROM elections e WHERE ${archived ? 'e.archived_at IS NOT NULL' : 'e.archived_at IS NULL'} ORDER BY e.start_date DESC`
    )
    res.json({ success: true, elections: r.rows })
  } catch (e) {
    console.error(e)
    res.status(500).json({ success: false, message: 'Failed to load elections.' })
  }
}

async function createElection(req, res) {
  try {
    const v = dates(req.body)

    const r = await pool.query(
      `INSERT INTO elections
             (election_name, description, start_date, end_date, status)
             VALUES (
                 $1,
                 $2,
                 $3,
                 $4,
                CASE
                    WHEN CURRENT_TIMESTAMP::timestamp without time zone
                        BETWEEN $3 AND $4
                    THEN 'ongoing'
                    ELSE 'upcoming'
                END    
             )
             RETURNING *`,
      [v.name, v.description || null, v.start.toISOString(), v.end.toISOString()]
    )

    await pool.query(
      `INSERT INTO activity_logs
             (activity_type, description, user_name, status)
             VALUES ($1, $2, $3, $4)`,
      ['Election created', `Election ${v.name} was created`, req.auth.user.username, 'Success']
    )

    res.status(201).json({
      success: true,
      message: 'Election created successfully.',
      election: r.rows[0],
    })
  } catch (e) {
    console.error(e)

    res.status(e.status || 500).json({
      success: false,
      message: e.status ? e.message : 'Failed to create election.',
    })
  }
}

async function updateElection(req, res) {
  try {
    const id = Number(req.params.id)
    const v = dates(req.body)

    const r = await pool.query(
      `UPDATE elections
            SET
                election_name = $1,
                description = $2,
                start_date = $3::timestamptz,
                end_date = $4::timestamptz,
                status = CASE
                    WHEN status = 'cancelled' THEN 'cancelled'
                    WHEN CURRENT_TIMESTAMP BETWEEN $3::timestamptz AND $4::timestamptz
                    THEN 'ongoing'
                    ELSE 'upcoming'
                END
            WHERE election_id = $5
            AND archived_at IS NULL
            RETURNING *`,
      [v.name, v.description || null, v.start.toISOString(), v.end.toISOString(), id]
    )

    if (!r.rowCount) {
      return res.status(404).json({
        success: false,
        message: 'Election not found.',
      })
    }

    await pool.query(
      `INSERT INTO activity_logs
             (activity_type, description, user_name, status)
             VALUES ($1, $2, $3, $4)`,
      ['Election updated', `Election ${v.name} was updated`, req.auth.user.username, 'Success']
    )

    res.json({
      success: true,
      message: 'Election updated successfully.',
      election: r.rows[0],
    })
  } catch (e) {
    console.error(e)

    res.status(e.status || 500).json({
      success: false,
      message: e.status ? e.message : 'Failed to update election.',
    })
  }
}

async function archiveElection(req, res) {
  try {
    const id = Number(req.params.id)
    const r = await pool.query(
      `UPDATE elections SET status='cancelled',archived_at=CURRENT_TIMESTAMP WHERE election_id=$1 AND archived_at IS NULL RETURNING election_id`,
      [id]
    )
    if (!r.rowCount)
      return res.status(404).json({ success: false, message: 'Active election not found.' })
    res.json({ success: true, message: 'Election archived successfully.' })
  } catch (e) {
    console.error(e)
    res.status(500).json({ success: false, message: 'Failed to archive election.' })
  }
}

async function restoreElection(req, res) {
  try {
    const id = Number(req.params.id)
    const r = await pool.query(
      `UPDATE elections SET status=CASE WHEN CURRENT_TIMESTAMP BETWEEN start_date AND end_date THEN 'ongoing' ELSE 'upcoming' END,archived_at=NULL WHERE election_id=$1 AND archived_at IS NOT NULL RETURNING election_id`,
      [id]
    )
    if (!r.rowCount)
      return res.status(404).json({ success: false, message: 'Archived election not found.' })
    res.json({ success: true, message: 'Election restored successfully.' })
  } catch (e) {
    console.error(e)
    res.status(500).json({ success: false, message: 'Failed to restore election.' })
  }
}

const deleteElection = archiveElection

module.exports = {
  getElections,
  createElection,
  updateElection,
  deleteElection,
  archiveElection,
  restoreElection,
}
