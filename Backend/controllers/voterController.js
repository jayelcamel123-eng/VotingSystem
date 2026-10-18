const bcrypt = require("bcrypt");
const pool = require("../config/db");

const normalize = (value) => String(value ?? "").trim();
const parseGrade = (value) => Number(value);

async function getVoters(req, res) {
  try {
    const archived = String(req.query.archived || "false") === "true";

    const result = await pool.query(`
            SELECT
                v.voter_id,
                v.user_id,
                v.name,
                v.grade,
                v.section,
                v.status,
                v.voting_status,
                v.created_at,
                v.archived_at,
                l.username,
                l.account_status
            FROM voters v
            JOIN login l ON l.user_id = v.user_id
            WHERE ${
              archived ? "v.archived_at IS NOT NULL" : "v.archived_at IS NULL"
            }
            ORDER BY v.created_at DESC
        `);

    res.json({
      success: true,
      voters: result.rows,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to load voters.",
    });
  }
}

async function getVoterById(req, res) {
  try {
    const requestedId = normalize(req.params.id).toUpperCase();

    if (
      req.auth?.user?.role === "voter" &&
      req.auth?.voter?.voter_id !== requestedId
    ) {
      return res.status(403).json({
        success: false,
        message: "You may only access your own voter record.",
      });
    }

    const result = await pool.query(
      `
            SELECT
                v.voter_id,
                v.user_id,
                v.name,
                v.grade,
                v.section,
                v.status,
                v.voting_status,
                v.created_at,
                v.archived_at,
                l.username,
                l.account_status
            FROM voters v
            JOIN login l ON l.user_id = v.user_id
            WHERE v.voter_id = $1
        `,
      [requestedId],
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Voter not found.",
      });
    }

    res.json({
      success: true,
      voter: result.rows[0],
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to load voter.",
    });
  }
}

async function createVoter(req, res) {
  const client = await pool.connect();

  try {
    const voterId = normalize(req.body?.voter_id).toUpperCase();

    const name = normalize(req.body?.name);

    const grade = parseGrade(req.body?.grade);

    const section = normalize(req.body?.section);

    const password = String(req.body?.password || "");

    if (!voterId) {
      return res.status(400).json({
        success: false,
        message: "Voter ID is required.",
      });
    }

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Name is required.",
      });
    }

    if (!Number.isInteger(grade) || grade < 7 || grade > 12) {
      return res.status(400).json({
        success: false,
        message: "Grade must be a whole number from 7 to 12.",
      });
    }

    if (!section) {
      return res.status(400).json({
        success: false,
        message: "Section is required.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
    }

    await client.query("BEGIN");

    // Check if voter ID already exists
    const exists = await client.query(
      "SELECT 1 FROM voters WHERE voter_id = $1",
      [voterId],
    );

    if (exists.rowCount) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        success: false,
        message: "Voter ID already exists.",
      });
    }

    // Check if voter ID is already used as a username
    const usernameExists = await client.query(
      "SELECT 1 FROM login WHERE username = $1",
      [voterId],
    );

    if (usernameExists.rowCount) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        success: false,
        message: "Voter ID is already used as a username.",
      });
    }

    // Create user account
    const user = await client.query(
      "INSERT INTO users(role) VALUES ('voter') RETURNING user_id",
    );

    const userId = user.rows[0].user_id;

    // Hash password
    const hash = await bcrypt.hash(password, 10);

    // Create login account
    await client.query(
      `INSERT INTO login
             (user_id, username, password_hash)
             VALUES ($1, $2, $3)`,
      [userId, voterId, hash],
    );

    // Create voter
    const voter = await client.query(
      `INSERT INTO voters
             (
                 voter_id,
                 user_id,
                 name,
                 grade,
                 section,
                 status,
                 voting_status
             )
             VALUES
             (
                 $1,
                 $2,
                 $3,
                 $4,
                 $5,
                 'active',
                 'not_voted'
             )
             RETURNING *`,
      [voterId, userId, name, grade, section],
    );

    // Record voter registration activity
    await client.query(
      `INSERT INTO activity_logs
             (
                 activity_type,
                 description,
                 user_name,
                 status
             )
             VALUES ($1, $2, $3, $4)`,
      [
        "Voter registered",
        `Voter ${voterId} - ${name} was registered`,
        req.auth?.user?.username || "Administrator",
        "Success",
      ],
    );

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Voter account created successfully.",
      voter: voter.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});

    console.error(error);

    res.status(500).json({
      success: false,
      message:
        error.code === "23505"
          ? "A voter with this ID already exists."
          : "Failed to create voter.",
    });
  } finally {
    client.release();
  }
}

async function updateVoter(req, res) {
  const client = await pool.connect();

  try {
    const voterId = normalize(req.params.id).toUpperCase();

    const name = normalize(req.body?.name);

    const grade = parseGrade(req.body?.grade);

    const section = normalize(req.body?.section);

    const password =
      req.body?.password == null ? "" : String(req.body.password);

    if (!voterId) {
      return res.status(400).json({
        success: false,
        message: "Voter ID is required.",
      });
    }

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Name is required.",
      });
    }

    if (!Number.isInteger(grade) || grade < 7 || grade > 12) {
      return res.status(400).json({
        success: false,
        message: "Grade must be a whole number from 7 to 12.",
      });
    }

    if (!section) {
      return res.status(400).json({
        success: false,
        message: "Section is required.",
      });
    }

    if (password && password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters.",
      });
    }

    await client.query("BEGIN");

    const found = await client.query(
      "SELECT user_id FROM voters WHERE voter_id=$1 FOR UPDATE",
      [voterId],
    );

    if (!found.rowCount) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Voter not found.",
      });
    }

    const userId = found.rows[0].user_id;

    await client.query(
      `UPDATE voters
             SET
                 name=$1,
                 grade=$2,
                 section=$3
             WHERE voter_id=$4`,
      [name, grade, section, voterId],
    );

    if (password) {
      await client.query(
        `UPDATE login
                 SET password_hash=$1
                 WHERE user_id=$2`,
        [await bcrypt.hash(password, 10), userId],
      );
    }

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Voter updated successfully.",
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to update voter.",
    });
  } finally {
    client.release();
  }
}

async function archiveVoter(req, res) {
  try {
    const id = normalize(req.params.id).toUpperCase();

    const result = await pool.query(
      `UPDATE voters
             SET
                 status='inactive',
                 archived_at=CURRENT_TIMESTAMP
             WHERE voter_id=$1
               AND archived_at IS NULL
             RETURNING voter_id`,
      [id],
    );

    if (!result.rowCount) {
      return res.status(404).json({
        success: false,
        message: "Active voter not found.",
      });
    }

    await pool.query(
      `UPDATE login
             SET account_status='inactive'
             WHERE user_id=(
                 SELECT user_id
                 FROM voters
                 WHERE voter_id=$1
             )`,
      [id],
    );

    res.json({
      success: true,
      message: "Voter archived successfully.",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to archive voter.",
    });
  }
}

async function restoreVoter(req, res) {
  try {
    const id = normalize(req.params.id).toUpperCase();

    const result = await pool.query(
      `UPDATE voters
             SET
                 status='active',
                 archived_at=NULL
             WHERE voter_id=$1
               AND archived_at IS NOT NULL
             RETURNING voter_id`,
      [id],
    );

    if (!result.rowCount) {
      return res.status(404).json({
        success: false,
        message: "Archived voter not found.",
      });
    }

    await pool.query(
      `UPDATE login
             SET account_status='active'
             WHERE user_id=(
                 SELECT user_id
                 FROM voters
                 WHERE voter_id=$1
             )`,
      [id],
    );

    res.json({
      success: true,
      message: "Voter restored successfully.",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to restore voter.",
    });
  }
}

const deleteVoter = archiveVoter;

module.exports = {
  getVoters,
  getVoterById,
  createVoter,
  updateVoter,
  deleteVoter,
  archiveVoter,
  restoreVoter,
};
