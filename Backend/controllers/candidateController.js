const pool = require("../config/db");
const clean = (v) => String(v ?? "").trim();
const gradeValue = (v) =>
  v === null || v === undefined || v === "" ? null : Number(v);

async function getCandidates(req, res) {
  try {
    const archived = String(req.query.archived || "false") === "true";
    const electionId = req.query.election_id
      ? Number(req.query.election_id)
      : null;
    const params = [];
    let where = archived
      ? "c.archived_at IS NOT NULL"
      : "c.archived_at IS NULL";
    if (electionId) {
      params.push(electionId);
      where += ` AND c.election_id=$${params.length}`;
    }
    const r = await pool.query(
      `SELECT c.*, p.position_name, e.election_name FROM candidates c JOIN positions p ON p.position_id=c.position_id JOIN elections e ON e.election_id=c.election_id WHERE ${where} ORDER BY c.position_id,c.candidate_name`,
      params,
    );
    res.json({ success: true, candidates: r.rows });
  } catch (e) {
    console.error(e);
    res
      .status(500)
      .json({ success: false, message: "Failed to load candidates." });
  }
}
async function validateCandidate(body) {
  const candidateName = clean(body?.candidate_name),
    positionId = Number(body?.position_id),
    electionId = Number(body?.election_id),
    grade = gradeValue(body?.grade),
    partyName = clean(body?.party_name);
  if (!candidateName)
    throw Object.assign(new Error("Candidate name is required."), {
      status: 400,
    });
  if (!Number.isInteger(positionId) || positionId < 1)
    throw Object.assign(new Error("A valid position is required."), {
      status: 400,
    });
  if (!Number.isInteger(electionId) || electionId < 1)
    throw Object.assign(new Error("A valid election is required."), {
      status: 400,
    });
  const pos = await pool.query(
    "SELECT position_name FROM positions WHERE position_id=$1 AND archived_at IS NULL",
    [positionId],
  );
  if (!pos.rowCount)
    throw Object.assign(new Error("Selected position does not exist."), {
      status: 400,
    });
  const election = await pool.query(
    "SELECT election_id FROM elections WHERE election_id=$1 AND archived_at IS NULL",
    [electionId],
  );
  if (!election.rowCount)
    throw Object.assign(new Error("Selected election does not exist."), {
      status: 400,
    });
  if (
    pos.rows[0].position_name.toLowerCase() === "grade representative" &&
    (!Number.isInteger(grade) || grade < 7 || grade > 12)
  )
    throw Object.assign(
      new Error("Grade Representative requires a grade from 7 to 12."),
      { status: 400 },
    );
  if (
    pos.rows[0].position_name.toLowerCase() !== "grade representative" &&
    grade !== null
  )
    throw Object.assign(
      new Error("Only Grade Representative candidates may have a grade."),
      { status: 400 },
    );
  return { candidateName, positionId, electionId, grade, partyName };
}

async function createCandidate(req, res) {
  try {
    const v = await validateCandidate(req.body);

    const r = await pool.query(
      `INSERT INTO candidates
             (candidate_name, position_id, election_id, grade, party_name, status)
             VALUES ($1, $2, $3, $4, $5, 'active')
             RETURNING *`,
      [
        v.candidateName,
        v.positionId,
        v.electionId,
        v.grade,
        v.partyName || null,
      ],
    );

    await pool.query(
      `INSERT INTO activity_logs
             (activity_type, description, user_name, status)
             VALUES ($1, $2, $3, $4)`,
      [
        "Candidate added",
        `Candidate ${v.candidateName} was added`,
        req.auth.user.username,
        "Success",
      ],
    );

    res.status(201).json({
      success: true,
      message: "Candidate created successfully.",
      candidate: r.rows[0],
    });
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({
      success: false,
      message: e.status ? e.message : "Failed to create candidate.",
    });
  }
}

async function updateCandidate(req, res) {
  try {
    const v = await validateCandidate(req.body);
    const id = Number(req.params.id);
    const r = await pool.query(
      `UPDATE candidates SET candidate_name=$1,position_id=$2,election_id=$3,grade=$4,party_name=$5 WHERE candidate_id=$6 AND archived_at IS NULL RETURNING *`,
      [
        v.candidateName,
        v.positionId,
        v.electionId,
        v.grade,
        v.partyName || null,
        id,
      ],
    );
    if (!r.rowCount)
      return res
        .status(404)
        .json({ success: false, message: "Candidate not found." });
    res.json({
      success: true,
      message: "Candidate updated successfully.",
      candidate: r.rows[0],
    });
  } catch (e) {
    console.error(e);
    res
      .status(e.status || 500)
      .json({
        success: false,
        message: e.status ? e.message : "Failed to update candidate.",
      });
  }
}

async function archiveCandidate(req, res) {
  try {
    const id = Number(req.params.id);
    const r = await pool.query(
      `UPDATE candidates SET status='inactive',archived_at=CURRENT_TIMESTAMP WHERE candidate_id=$1 AND archived_at IS NULL RETURNING candidate_id`,
      [id],
    );
    if (!r.rowCount)
      return res
        .status(404)
        .json({ success: false, message: "Active candidate not found." });
    res.json({ success: true, message: "Candidate archived successfully." });
  } catch (e) {
    console.error(e);
    res
      .status(500)
      .json({ success: false, message: "Failed to archive candidate." });
  }
}

async function restoreCandidate(req, res) {
  try {
    const id = Number(req.params.id);
    const r = await pool.query(
      `UPDATE candidates SET status='active',archived_at=NULL WHERE candidate_id=$1 AND archived_at IS NOT NULL RETURNING candidate_id`,
      [id],
    );
    if (!r.rowCount)
      return res
        .status(404)
        .json({ success: false, message: "Archived candidate not found." });
    res.json({ success: true, message: "Candidate restored successfully." });
  } catch (e) {
    console.error(e);
    res
      .status(500)
      .json({ success: false, message: "Failed to restore candidate." });
  }
}

const deleteCandidate = archiveCandidate;

module.exports = {
  getCandidates,
  createCandidate,
  updateCandidate,
  deleteCandidate,
  archiveCandidate,
  restoreCandidate,
};
