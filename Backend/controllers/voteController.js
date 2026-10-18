const pool = require('../config/db')

async function castVote(req, res) {
  const client = await pool.connect()
  try {
    const voterId = String(req.body?.voter_id || '')
      .trim()
      .toUpperCase()
    const electionId = Number(req.body?.election_id)
    const selections = Array.isArray(req.body?.selections) ? req.body.selections : []
    if (!voterId || !Number.isInteger(electionId) || !selections.length)
      return res.status(400).json({
        success: false,
        message: 'Voter, election, and at least one selection are required.',
      })
    if (req.auth.user.role === 'voter' && req.auth.voter?.voter_id !== voterId)
      return res.status(403).json({
        success: false,
        message: 'You may only submit your own ballot.',
      })
    await client.query('BEGIN')
    const voter = (
      await client.query(
        `SELECT voter_id,name,grade,status,voting_status FROM voters WHERE voter_id=$1 FOR UPDATE`,
        [voterId]
      )
    ).rows[0]
    if (!voter) {
      await client.query('ROLLBACK')
      return res.status(404).json({ success: false, message: 'Voter not found.' })
    }
    if (voter.status !== 'active') {
      await client.query('ROLLBACK')
      return res.status(403).json({ success: false, message: 'Voter account is not active.' })
    }
    if (voter.voting_status === 'voted') {
      await client.query('ROLLBACK')
      return res.status(409).json({ success: false, message: 'This voter has already voted.' })
    }
    const election = (
      await client.query(
        `SELECT election_id,election_name,status,start_date,end_date FROM elections WHERE election_id=$1 AND archived_at IS NULL`,
        [electionId]
      )
    ).rows[0]
    if (!election) {
      await client.query('ROLLBACK')
      return res.status(404).json({ success: false, message: 'Election not found.' })
    }
    const now = Date.now(),
      start = new Date(election.start_date).getTime(),
      end = new Date(election.end_date).getTime()
    if (!(now >= start && now <= end) && election.status !== 'ongoing') {
      await client.query('ROLLBACK')
      return res.status(403).json({
        success: false,
        message: 'Voting is not currently open for this election.',
      })
    }

    const posIds = selections.map((x) => Number(x.position_id))
    const uniquePos = new Set(posIds)
    if (uniquePos.size !== posIds.length) {
      await client.query('ROLLBACK')
      return res.status(400).json({
        success: false,
        message: 'Only one candidate may be selected for each position.',
      })
    }

    const positions = (
      await client.query(
        `SELECT position_id,position_name FROM positions WHERE position_id=ANY($1::int[]) AND archived_at IS NULL`,
        [posIds]
      )
    ).rows
    if (positions.length !== selections.length) {
      await client.query('ROLLBACK')
      return res.status(400).json({
        success: false,
        message: 'One or more selected positions are invalid.',
      })
    }

    for (const s of selections) {
      const candidate = (
        await client.query(
          `SELECT candidate_id,candidate_name,position_id,election_id,grade,status FROM candidates WHERE candidate_id=$1 AND archived_at IS NULL`,
          [Number(s.candidate_id)]
        )
      ).rows[0]
      if (
        !candidate ||
        candidate.election_id !== electionId ||
        candidate.position_id !== Number(s.position_id) ||
        candidate.status !== 'active'
      ) {
        await client.query('ROLLBACK')
        return res.status(400).json({
          success: false,
          message: 'One or more selected candidates are invalid.',
        })
      }
      const position = positions.find((p) => p.position_id === candidate.position_id)
      if (
        position.position_name.toLowerCase() === 'grade representative' &&
        Number(candidate.grade) !== Number(voter.grade)
      ) {
        await client.query('ROLLBACK')
        return res.status(403).json({
          success: false,
          message: `You may only vote for Grade ${voter.grade} Representative candidates.`,
        })
      }
    }
    for (const s of selections) {
      await client.query(
        `INSERT INTO votes(voter_id,candidate_id,position_id,election_id)
         VALUES($1,$2,$3,$4)`,
        [voterId, Number(s.candidate_id), Number(s.position_id), electionId]
      )
    }

    await client.query(
      `UPDATE voters
     SET voting_status='voted'
     WHERE voter_id=$1`,
      [voterId]
    )

    await client.query(
      `INSERT INTO activity_logs
     (activity_type, description, user_name, status)
     VALUES ($1, $2, $3, $4)`,
      [
        'Vote submitted',
        `${voter.name} submitted their vote for ${election.election_name}`,
        voter.name,
        'Recorded',
      ]
    )

    await client.query('COMMIT')
    res.status(201).json({
      success: true,
      message: 'Vote submitted successfully.',
      election: election.election_name,
    })
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    console.error(e)
    res.status(e.code === '23505' ? 409 : 500).json({
      success: false,
      message:
        e.code === '23505' ? 'This ballot has already been recorded.' : 'Failed to submit vote.',
    })
  } finally {
    client.release()
  }
}

async function getBallot(req, res) {
  try {
    const voterId = String(req.params.voterId || '')
      .trim()
      .toUpperCase()

    if (req.auth.user.role === 'voter' && req.auth.voter?.voter_id !== voterId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized.',
      })
    }

    /* =====================================================
           GET VOTER
        ===================================================== */

    const voter = (
      await pool.query(
        `SELECT
                    voter_id,
                    name,
                    grade,
                    section,
                    status,
                    voting_status
                 FROM voters
                 WHERE voter_id = $1
                   AND archived_at IS NULL`,
        [voterId]
      )
    ).rows[0]

    if (!voter) {
      return res.status(404).json({
        success: false,
        message: 'Voter not found.',
      })
    }

    /* =====================================================
           GET CURRENT ELECTION
        ===================================================== */

    const election =
      (
        await pool.query(
          `SELECT *
                 FROM elections
                 WHERE archived_at IS NULL
                   AND CURRENT_TIMESTAMP BETWEEN start_date AND end_date
                 ORDER BY start_date
                 LIMIT 1`
        )
      ).rows[0] || null

    /* =====================================================
           NO ACTIVE ELECTION
        ===================================================== */

    if (!election) {
      return res.json({
        success: true,
        election: null,
        voter,
        candidates: [],
        results: [],
        resultSummary: {
          registeredVoters: 0,
          votesCast: 0,
          turnout: 0,
        },
      })
    }

    /* =====================================================
           REGISTERED VOTERS
        ===================================================== */

    const registeredVotersResult = await pool.query(
      `SELECT COUNT(*)::int AS registered_voters
                 FROM voters
                 WHERE archived_at IS NULL
                   AND status = 'active'`
    )

    const registeredVoters = Number(registeredVotersResult.rows[0]?.registered_voters || 0)

    /* =====================================================
           VOTES CAST
           Count each voter only once
        ===================================================== */

    const voteCastResult = await pool.query(
      `SELECT COUNT(DISTINCT voter_id)::int AS votes_cast
                 FROM votes
                 WHERE election_id = $1`,
      [election.election_id]
    )

    const votesCast = Number(voteCastResult.rows[0]?.votes_cast || 0)

    /* =====================================================
           TURNOUT
        ===================================================== */

    const turnout =
      registeredVoters > 0 ? Number(((votesCast / registeredVoters) * 100).toFixed(1)) : 0

    /* =====================================================
           GET CANDIDATES
        ===================================================== */

    const candidates = (
      await pool.query(
        `SELECT
                    c.candidate_id,
                    c.candidate_name,
                    c.position_id,
                    c.grade,
                    c.party_name,
                    p.position_name
                 FROM candidates c
                 JOIN positions p
                   ON p.position_id = c.position_id
                 WHERE c.election_id = $1
                   AND c.status = 'active'
                   AND c.archived_at IS NULL
                 ORDER BY
                    c.position_id,
                    c.candidate_name`,
        [election.election_id]
      )
    ).rows

    /* =====================================================
           ELECTION RESULTS
           Vote count is grouped by candidate.
        ===================================================== */

    const resultRows = (
      await pool.query(
        `SELECT
                    c.candidate_id,
                    c.candidate_name,
                    c.position_id,
                    c.party_name,
                    p.position_name,
                    COUNT(v.vote_id)::int AS vote_count
                 FROM candidates c
                 JOIN positions p
                   ON p.position_id = c.position_id
                 LEFT JOIN votes v
                   ON v.candidate_id = c.candidate_id
                  AND v.election_id = $1
                 WHERE c.election_id = $1
                   AND c.status = 'active'
                   AND c.archived_at IS NULL
                 GROUP BY
                    c.candidate_id,
                    c.candidate_name,
                    c.position_id,
                    c.party_name,
                    p.position_name
                 ORDER BY
                    c.position_id,
                    vote_count DESC,
                    c.candidate_name`,
        [election.election_id]
      )
    ).rows

    /* =====================================================
           CALCULATE PERCENTAGE PER POSITION
        ===================================================== */

    const positionTotals = {}

    resultRows.forEach((row) => {
      const positionId = row.position_id

      if (!positionTotals[positionId]) {
        positionTotals[positionId] = 0
      }

      positionTotals[positionId] += Number(row.vote_count || 0)
    })

    const results = resultRows.map((row) => {
      const voteCount = Number(row.vote_count || 0)

      const totalForPosition = positionTotals[row.position_id] || 0

      const percentage =
        totalForPosition > 0 ? Number(((voteCount / totalForPosition) * 100).toFixed(1)) : 0

      return {
        candidate_id: row.candidate_id,

        candidate_name: row.candidate_name,

        position_id: row.position_id,

        position_name: row.position_name,

        party_name: row.party_name,

        vote_count: voteCount,

        percentage: percentage,
      }
    })

    /* =====================================================
           RESPONSE
        ===================================================== */

    res.json({
      success: true,

      election,

      voter,

      candidates,

      voteCast: votesCast,

      results,

      resultSummary: {
        registeredVoters,
        votesCast,
        turnout,
      },
    })
  } catch (e) {
    console.error('Get ballot error:', e)

    res.status(500).json({
      success: false,
      message: 'Failed to load ballot.',
    })
  }
}

module.exports = { castVote, getBallot }
