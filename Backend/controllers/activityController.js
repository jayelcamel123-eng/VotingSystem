const pool = require("../config/db");

async function getRecentActivity(req, res) {
  try {
    const result = await pool.query(`
            SELECT
                activity_id,
                activity_type,
                description,
                user_name,
                status,
                created_at
            FROM activity_logs
            ORDER BY created_at DESC
            LIMIT 1000
        `);

    res.json({
      success: true,
      activities: result.rows,
    });
  } catch (error) {
    console.error("Activity log error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load recent activity.",
    });
  }
}

module.exports = {
  getRecentActivity,
};
