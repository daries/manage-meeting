const express = require('express');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/attendance/:token — get meeting info for attendance (PUBLIC)
router.get('/:token', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.id, m.title, m.meeting_date, m.start_time, m.end_time,
             m.location, m.meeting_type, m.online_link, m.status,
             u.full_name as organizer_name, u.jabatan as organizer_jabatan,
             u.department as organizer_department,
             COUNT(a.id) as attendance_count
      FROM meetings m
      LEFT JOIN users u ON m.created_by = u.id
      LEFT JOIN attendance a ON m.id = a.meeting_id
      WHERE m.attendance_token = $1
      GROUP BY m.id, u.full_name, u.jabatan, u.department
    `, [req.params.token]);

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Link presensi tidak ditemukan' });
    }

    const agendas = await pool.query(
      'SELECT title, order_number FROM agendas WHERE meeting_id = $1 ORDER BY order_number',
      [result.rows[0].id]
    );

    res.json({ ...result.rows[0], agendas: agendas.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/attendance/:token — submit attendance (PUBLIC)
router.post('/:token', async (req, res) => {
  const { name, email, phone, jabatan, department, organization } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Nama wajib diisi' });
  }

  try {
    const meetingResult = await pool.query(
      'SELECT id, status FROM meetings WHERE attendance_token = $1',
      [req.params.token]
    );

    if (!meetingResult.rows[0]) {
      return res.status(404).json({ message: 'Link presensi tidak ditemukan' });
    }

    const meeting = meetingResult.rows[0];

    // Check if email already attended
    if (email) {
      const existing = await pool.query(
        'SELECT id FROM attendance WHERE meeting_id = $1 AND email = $2',
        [meeting.id, email]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ message: 'Email ini sudah melakukan presensi' });
      }
    }

    // Find user_id if email matches registered user
    let userId = null;
    if (email) {
      const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (userResult.rows[0]) userId = userResult.rows[0].id;
    }

    const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    const result = await pool.query(`
      INSERT INTO attendance (meeting_id, user_id, name, email, phone, jabatan, department, organization, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [meeting.id, userId, name, email, phone, jabatan, department, organization, ipAddress]);

    res.status(201).json({
      message: 'Presensi berhasil dicatat',
      attendance: result.rows[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/attendance/meeting/:meetingId — get all attendance for a meeting (AUTH)
router.get('/meeting/:meetingId', authenticate, async (req, res) => {
  try {
    // Check access
    const access = await pool.query(`
      SELECT m.id FROM meetings m
      LEFT JOIN meeting_participants mp ON m.id = mp.meeting_id
      WHERE m.id = $1 AND (m.created_by = $2 OR mp.user_id = $2)
    `, [req.params.meetingId, req.user.id]);

    if (!access.rows[0]) {
      return res.status(403).json({ message: 'Akses ditolak' });
    }

    const result = await pool.query(
      'SELECT * FROM attendance WHERE meeting_id = $1 ORDER BY attended_at ASC',
      [req.params.meetingId]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
