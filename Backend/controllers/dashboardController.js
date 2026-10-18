const pool = require('../config/db')

async function getDashboardStats(req, res) {
  try {
    const voters = (
      await pool.query(
        "SELECT COUNT(*)::int total FROM voters WHERE status='active' AND archived_at IS NULL"
      )
    ).rows[0].total
    const candidates = (
      await pool.query(
        "SELECT COUNT(*)::int total FROM candidates WHERE status='active' AND archived_at IS NULL"
      )
    ).rows[0].total
    const elections = (
      await pool.query(
        "SELECT COUNT(*)::int total FROM elections WHERE archived_at IS NULL AND status <> 'cancelled' AND CURRENT_TIMESTAMP BETWEEN start_date AND end_date"
      )
    ).rows[0].total
    const votes = (
      await pool.query(
        'SELECT COUNT(DISTINCT v.voter_id)::int total FROM votes v JOIN elections e ON e.election_id=v.election_id WHERE e.archived_at IS NULL AND CURRENT_TIMESTAMP BETWEEN e.start_date AND e.end_date'
      )
    ).rows[0].total
    const current =
      (
        await pool.query(
          `SELECT election_id,election_name,start_date,end_date,CASE WHEN CURRENT_TIMESTAMP < start_date THEN 'upcoming' WHEN CURRENT_TIMESTAMP BETWEEN start_date AND end_date THEN 'ongoing' ELSE 'ended' END AS status FROM elections WHERE archived_at IS NULL AND status <> 'cancelled' AND end_date >= CURRENT_TIMESTAMP ORDER BY start_date LIMIT 1`
        )
      ).rows[0] || null
    res.json({
      success: true,
      stats: {
        totalVoters: voters,
        totalCandidates: candidates,
        activeElections: elections,
        votesCast: votes,
      },
      currentElection: current,
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({
      success: false,
      message: 'Failed to load dashboard statistics.',
    })
  }
}

module.exports = { getDashboardStats }
