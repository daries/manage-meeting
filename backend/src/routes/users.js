const express = require('express');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/users/search?q=name — search users for participant selection
router.get('/search', authenticate, async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);

  try {
    const result = await pool.query(`
      SELECT id, email, full_name, jabatan, department, organization
      FROM users
      WHERE is_active = true AND (
        full_name ILIKE $1 OR email ILIKE $1
      )
      AND id != $2
      LIMIT 10
    `, [`%${q}%`, req.user.id]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/users/stats — user dashboard stats
router.get('/stats', authenticate, async (req, res) => {
  try {
    const totalMeetings = await pool.query(`
      SELECT COUNT(DISTINCT m.id) FROM meetings m
      LEFT JOIN meeting_participants mp ON m.id = mp.meeting_id
      WHERE m.created_by = $1 OR mp.user_id = $1
    `, [req.user.id]);

    const upcomingMeetings = await pool.query(`
      SELECT COUNT(DISTINCT m.id) FROM meetings m
      LEFT JOIN meeting_participants mp ON m.id = mp.meeting_id
      WHERE (m.created_by = $1 OR mp.user_id = $1)
        AND m.status IN ('scheduled', 'ongoing')
        AND m.meeting_date >= CURRENT_DATE
    `, [req.user.id]);

    const myMeetings = await pool.query(`
      SELECT COUNT(*) FROM meetings WHERE created_by = $1
    `, [req.user.id]);

    const pendingApprovals = await pool.query(`
      SELECT COUNT(DISTINCT m.id) FROM meetings m
      JOIN meeting_participants mp ON m.id = mp.meeting_id
      LEFT JOIN minutes_approvals ma ON m.id = ma.meeting_id AND ma.user_id = $1
      WHERE mp.user_id = $1 AND m.minutes_locked = false
        AND EXISTS (SELECT 1 FROM meeting_minutes mm WHERE mm.meeting_id = m.id)
        AND (ma.approved IS NULL OR ma.approved = false)
    `, [req.user.id]);

    res.json({
      total_meetings: parseInt(totalMeetings.rows[0].count),
      upcoming_meetings: parseInt(upcomingMeetings.rows[0].count),
      my_meetings: parseInt(myMeetings.rows[0].count),
      pending_approvals: parseInt(pendingApprovals.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
