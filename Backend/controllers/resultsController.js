const pool = require("../config/db");

async function getResults(req, res) {
  try {
    let electionId = req.query.election_id
      ? Number(req.query.election_id)
      : null;

    const grade = req.query.grade ? String(req.query.grade).trim() : "";

    const section = req.query.section ? String(req.query.section).trim() : "";

    // Get default election if no election_id was provided
    if (!electionId) {
      const r = await pool.query(`
                SELECT election_id
                FROM elections
                WHERE archived_at IS NULL
                ORDER BY
                    CASE
                        WHEN status = 'ongoing' THEN 0
                        WHEN status = 'ended' THEN 1
                        ELSE 2
                    END,
                    start_date DESC
                LIMIT 1
            `);

      electionId = r.rows[0]?.election_id || null;
    }

    if (!electionId) {
      return res.json({
        success: true,
        election: null,
        results: [],
        summary: {
          votesCast: 0,
          totalVoters: 0,
          turnout: 0,
        },
      });
    }

    // Get election
    const election = (
      await pool.query("SELECT * FROM elections WHERE election_id = $1", [
        electionId,
      ])
    ).rows[0];

    if (!election) {
      return res.status(404).json({
        success: false,
        message: "Election not found.",
      });
    }

    // Build voter filter
    const voterConditions = [`v.status = 'active'`, `v.archived_at IS NULL`];

    const voterParams = [];
    let paramIndex = 1;

    if (grade) {
      voterParams.push(grade);
      voterConditions.push(`v.grade::text = $${paramIndex}`);
      paramIndex++;
    }

    if (section) {
      voterParams.push(section);
      voterConditions.push(`v.section = $${paramIndex}`);
      paramIndex++;
    }

    // Candidate results
    const resultParams = [electionId];
    let resultVoterFilter = "";

    if (grade || section) {
      const filterParts = [];

      if (grade) {
        resultParams.push(grade);
        filterParts.push(`voter_filter.grade::text = $${resultParams.length}`);
      }

      if (section) {
        resultParams.push(section);
        filterParts.push(`voter_filter.section = $${resultParams.length}`);
      }

      resultVoterFilter = `
                AND EXISTS (
                    SELECT 1
                    FROM voters voter_filter
                    WHERE voter_filter.voter_id = v.voter_id
                    ${
                      filterParts.length
                        ? `AND ${filterParts.join(" AND ")}`
                        : ""
                    }
                    AND voter_filter.status = 'active'
                    AND voter_filter.archived_at IS NULL
                )
            `;
    }

    const results = (
      await pool.query(
        `
                SELECT
                    p.position_id,
                    p.position_name,
                    c.candidate_id,
                    c.candidate_name,
                    c.grade,
                    c.party_name,
                    COUNT(v.vote_id)::int AS votes

                FROM candidates c

                JOIN positions p
                    ON p.position_id = c.position_id

                LEFT JOIN votes v
                    ON v.candidate_id = c.candidate_id
                    AND v.election_id = $1
                    ${resultVoterFilter}

                WHERE c.election_id = $1
                  AND c.archived_at IS NULL

                GROUP BY
                    p.position_id,
                    p.position_name,
                    c.candidate_id,
                    c.candidate_name,
                    c.grade,
                    c.party_name

                ORDER BY
                    p.position_id,
                    votes DESC,
                    c.candidate_name
                `,
        resultParams,
      )
    ).rows;

    // Registered voters
    const voters = (
      await pool.query(
        `
                SELECT COUNT(*)::int AS total
                FROM voters v
                WHERE ${voterConditions.join(" AND ")}
                `,
        voterParams,
      )
    ).rows[0].total;

    // Voters who actually voted
    const votedParams = [electionId];
    const votedConditions = [`votes.election_id = $1`];

    let votedParamIndex = 2;

    if (grade) {
      votedParams.push(grade);
      votedConditions.push(`v.grade::text = $${votedParamIndex}`);
      votedParamIndex++;
    }

    if (section) {
      votedParams.push(section);
      votedConditions.push(`v.section = $${votedParamIndex}`);
      votedParamIndex++;
    }

    const voted = (
      await pool.query(
        `
                SELECT COUNT(DISTINCT votes.voter_id)::int AS total
                FROM votes

                JOIN voters v
                    ON v.voter_id = votes.voter_id

                WHERE ${votedConditions.join(" AND ")}
                  AND v.status = 'active'
                  AND v.archived_at IS NULL
                `,
        votedParams,
      )
    ).rows[0].total;

    const turnout = voters ? Number(((voted / voters) * 100).toFixed(1)) : 0;

    res.json({
      success: true,
      election,
      results,
      summary: {
        votesCast: voted,
        totalVoters: voters,
        turnout,
      },
    });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      success: false,
      message: "Failed to load election results.",
    });
  }
}

module.exports = {
  getResults,
};
