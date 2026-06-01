const express = require('express');
const pool = require('../config/db');
const { authenticate, requireProfileComplete } = require('../middleware/auth');
const { sendEmail } = require('../services/emailService');
const { sendWhatsApp } = require('../services/whatsappService');
const { format } = require('date-fns');

const router = express.Router();

// Helper: get meeting with details
async function getMeetingDetails(meetingId) {
  const meeting = await pool.query(`
    SELECT m.*, u.full_name as creator_name, u.email as creator_email
    FROM meetings m
    LEFT JOIN users u ON m.created_by = u.id
    WHERE m.id = $1
  `, [meetingId]);

  if (!meeting.rows[0]) return null;

  const participants = await pool.query(`
    SELECT mp.*, u.full_name, u.email, u.phone, u.jabatan, u.department
    FROM meeting_participants mp
    LEFT JOIN users u ON mp.user_id = u.id
    WHERE mp.meeting_id = $1
    ORDER BY mp.role DESC, mp.invited_at ASC
  `, [meetingId]);

  const agendas = await pool.query(`
    SELECT a.*, u.full_name as pic_full_name
    FROM agendas a
    LEFT JOIN users u ON a.pic_user_id = u.id
    WHERE a.meeting_id = $1
    ORDER BY a.order_number
  `, [meetingId]);

  const attendance = await pool.query(`
    SELECT * FROM attendance WHERE meeting_id = $1 ORDER BY attended_at ASC
  `, [meetingId]);

  return {
    ...meeting.rows[0],
    participants: participants.rows,
    agendas: agendas.rows,
    attendance: attendance.rows,
  };
}

// GET /api/meetings — list user meetings
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT DISTINCT m.*, u.full_name as creator_name,
        COUNT(DISTINCT mp2.id) as participant_count,
        COUNT(DISTINCT a.id) as attendance_count
      FROM meetings m
      LEFT JOIN users u ON m.created_by = u.id
      LEFT JOIN meeting_participants mp ON m.id = mp.meeting_id
      LEFT JOIN meeting_participants mp2 ON m.id = mp2.meeting_id
      LEFT JOIN attendance a ON m.id = a.meeting_id
      WHERE (m.created_by = $1 OR mp.user_id = $1)
    `;
    const params = [req.user.id];
    let paramIdx = 2;

    if (status) {
      query += ` AND m.status = $${paramIdx}`;
      params.push(status);
      paramIdx++;
    }
    if (search) {
      query += ` AND (m.title ILIKE $${paramIdx} OR m.description ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    query += `
      GROUP BY m.id, u.full_name
      ORDER BY m.meeting_date DESC, m.start_time DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    const countResult = await pool.query(`
      SELECT COUNT(DISTINCT m.id) FROM meetings m
      LEFT JOIN meeting_participants mp ON m.id = mp.meeting_id
      WHERE (m.created_by = $1 OR mp.user_id = $1)
      ${status ? 'AND m.status = $2' : ''}
    `, status ? [req.user.id, status] : [req.user.id]);

    res.json({
      meetings: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/meetings/upcoming
router.get('/upcoming', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT m.*, u.full_name as creator_name
      FROM meetings m
      LEFT JOIN users u ON m.created_by = u.id
      LEFT JOIN meeting_participants mp ON m.id = mp.meeting_id
      WHERE (m.created_by = $1 OR mp.user_id = $1)
        AND m.status IN ('scheduled', 'ongoing')
        AND m.meeting_date >= CURRENT_DATE
      ORDER BY m.meeting_date ASC, m.start_time ASC
      LIMIT 5
    `, [req.user.id]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/meetings/search — full text search
router.get('/search', authenticate, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);

  try {
    const result = await pool.query(`
      SELECT DISTINCT m.*, u.full_name as creator_name,
        ts_rank(m.search_vector, plainto_tsquery('indonesian', $2)) as rank
      FROM meetings m
      LEFT JOIN users u ON m.created_by = u.id
      LEFT JOIN meeting_participants mp ON m.id = mp.meeting_id
      LEFT JOIN meeting_minutes mm ON m.id = mm.meeting_id
      WHERE (m.created_by = $1 OR mp.user_id = $1)
        AND (
          m.search_vector @@ plainto_tsquery('indonesian', $2)
          OR m.title ILIKE $3
          OR mm.discussion ILIKE $3
          OR mm.decisions ILIKE $3
        )
      ORDER BY rank DESC, m.meeting_date DESC
      LIMIT 20
    `, [req.user.id, q, `%${q}%`]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/meetings — create meeting
router.post('/', authenticate, requireProfileComplete, async (req, res) => {
  const {
    title, description, meeting_date, start_time, end_time,
    location, meeting_type, online_link, participants, agendas
  } = req.body;

  if (!title || !meeting_date || !start_time) {
    return res.status(400).json({ message: 'Judul, tanggal, dan waktu wajib diisi' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create meeting
    const meetingResult = await client.query(`
      INSERT INTO meetings (title, description, meeting_date, start_time, end_time, location, meeting_type, online_link, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [title, description, meeting_date, start_time, end_time, location, meeting_type || 'offline', online_link, req.user.id]);

    const meeting = meetingResult.rows[0];

    // Add creator as organizer
    await client.query(`
      INSERT INTO meeting_participants (meeting_id, user_id, role)
      VALUES ($1, $2, 'organizer')
      ON CONFLICT (meeting_id, user_id) DO NOTHING
    `, [meeting.id, req.user.id]);

    // Add participants
    if (participants && participants.length > 0) {
      for (const p of participants) {
        if (p.user_id) {
          await client.query(`
            INSERT INTO meeting_participants (meeting_id, user_id, role, jabatan)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (meeting_id, user_id) DO NOTHING
          `, [meeting.id, p.user_id, p.role || 'participant', p.jabatan || null]);
        } else if (p.email) {
          await client.query(`
            INSERT INTO meeting_participants (meeting_id, external_email, external_name, external_phone, role, jabatan)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (meeting_id, external_email) DO NOTHING
          `, [meeting.id, p.email, p.name, p.phone, p.role || 'participant', p.jabatan || null]);
        }
      }
    }

    // Add agendas
    if (agendas && agendas.length > 0) {
      for (let i = 0; i < agendas.length; i++) {
        const a = agendas[i];
        await client.query(`
          INSERT INTO agendas (meeting_id, order_number, title, description, duration_minutes, pic_user_id, pic_name)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [meeting.id, i + 1, a.title, a.description, a.duration_minutes || null, a.pic_user_id || null, a.pic_name]);
      }
    }

    await client.query('COMMIT');

    const fullMeeting = await getMeetingDetails(meeting.id);
    res.status(201).json(fullMeeting);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Gagal membuat rapat' });
  } finally {
    client.release();
  }
});

// GET /api/meetings/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const meeting = await getMeetingDetails(req.params.id);
    if (!meeting) {
      return res.status(404).json({ message: 'Rapat tidak ditemukan' });
    }

    // Check access
    const isParticipant = meeting.participants.some(p => p.user_id === req.user.id);
    const isCreator = meeting.created_by === req.user.id;
    if (!isCreator && !isParticipant) {
      return res.status(403).json({ message: 'Akses ditolak' });
    }

    res.json(meeting);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/meetings/:id
router.put('/:id', authenticate, requireProfileComplete, async (req, res) => {
  const { title, description, meeting_date, start_time, end_time, location, meeting_type, online_link, status } = req.body;

  try {
    const check = await pool.query('SELECT * FROM meetings WHERE id = $1', [req.params.id]);
    if (!check.rows[0]) return res.status(404).json({ message: 'Rapat tidak ditemukan' });
    if (check.rows[0].created_by !== req.user.id) return res.status(403).json({ message: 'Hanya pembuat rapat yang bisa mengedit' });

    const result = await pool.query(`
      UPDATE meetings SET title=$1, description=$2, meeting_date=$3, start_time=$4, end_time=$5,
        location=$6, meeting_type=$7, online_link=$8, status=COALESCE($9, status), updated_at=NOW()
      WHERE id=$10
      RETURNING *
    `, [title, description, meeting_date, start_time, end_time, location, meeting_type, online_link, status, req.params.id]);

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/meetings/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const check = await pool.query('SELECT created_by FROM meetings WHERE id = $1', [req.params.id]);
    if (!check.rows[0]) return res.status(404).json({ message: 'Rapat tidak ditemukan' });
    if (check.rows[0].created_by !== req.user.id) return res.status(403).json({ message: 'Hanya pembuat rapat yang bisa menghapus' });

    await pool.query('DELETE FROM meetings WHERE id = $1', [req.params.id]);
    res.json({ message: 'Rapat berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/meetings/:id/notify — send invitations
router.post('/:id/notify', authenticate, requireProfileComplete, async (req, res) => {
  const { type = 'invitation' } = req.body;

  try {
    const meeting = await getMeetingDetails(req.params.id);
    if (!meeting) return res.status(404).json({ message: 'Rapat tidak ditemukan' });
    if (meeting.created_by !== req.user.id) return res.status(403).json({ message: 'Akses ditolak' });

    const dateStr = format(new Date(meeting.meeting_date), 'dd MMMM yyyy');
    const results = [];

    for (const p of meeting.participants) {
      const recipientName = p.full_name || p.external_name || 'Peserta';
      const recipientEmail = p.email || p.external_email;
      const recipientPhone = p.phone || p.external_phone;

      const notifData = {
        recipientName,
        meetingTitle: meeting.title,
        meetingDate: dateStr,
        startTime: meeting.start_time,
        endTime: meeting.end_time,
        location: meeting.location,
        onlineLink: meeting.online_link,
        organizerName: meeting.creator_name,
        attendanceToken: meeting.attendance_token,
        meetingId: meeting.id,
        agendas: meeting.agendas,
        description: meeting.description,
      };

      // Send email
      if (recipientEmail) {
        const emailResult = await sendEmail(recipientEmail, type, notifData);
        if (emailResult.success) {
          await pool.query(`
            UPDATE meeting_participants SET notified_email = true
            WHERE meeting_id = $1 AND (user_id = $2 OR external_email = $3)
          `, [meeting.id, p.user_id, recipientEmail]);
        }
        results.push({ channel: 'email', to: recipientEmail, ...emailResult });
      }

      // Send WhatsApp
      if (recipientPhone) {
        const waResult = await sendWhatsApp(recipientPhone, type, notifData);
        if (waResult.success) {
          await pool.query(`
            UPDATE meeting_participants SET notified_wa = true
            WHERE meeting_id = $1 AND (user_id = $2 OR external_email = $3)
          `, [meeting.id, p.user_id, recipientEmail]);
        }
        results.push({ channel: 'whatsapp', to: recipientPhone, ...waResult });
      }
    }

    res.json({ message: 'Notifikasi berhasil dikirim', results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengirim notifikasi' });
  }
});

// POST /api/meetings/:id/participants — add participant
router.post('/:id/participants', authenticate, async (req, res) => {
  const { user_id, email, name, phone, role, jabatan } = req.body;

  try {
    const check = await pool.query('SELECT created_by FROM meetings WHERE id = $1', [req.params.id]);
    if (!check.rows[0]) return res.status(404).json({ message: 'Rapat tidak ditemukan' });
    if (check.rows[0].created_by !== req.user.id) return res.status(403).json({ message: 'Akses ditolak' });

    if (user_id) {
      const result = await pool.query(`
        INSERT INTO meeting_participants (meeting_id, user_id, role, jabatan)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (meeting_id, user_id) DO UPDATE SET role = EXCLUDED.role, jabatan = EXCLUDED.jabatan
        RETURNING *
      `, [req.params.id, user_id, role || 'participant', jabatan || null]);
      return res.json(result.rows[0]);
    } else if (email) {
      const result = await pool.query(`
        INSERT INTO meeting_participants (meeting_id, external_email, external_name, external_phone, role, jabatan)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (meeting_id, external_email) DO UPDATE SET external_name = EXCLUDED.external_name, jabatan = EXCLUDED.jabatan
        RETURNING *
      `, [req.params.id, email, name, phone, role || 'participant', jabatan || null]);
      return res.json(result.rows[0]);
    }

    res.status(400).json({ message: 'user_id atau email wajib diisi' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/meetings/:id/participants/:participantId
router.delete('/:id/participants/:participantId', authenticate, async (req, res) => {
  try {
    const check = await pool.query('SELECT created_by FROM meetings WHERE id = $1', [req.params.id]);
    if (check.rows[0].created_by !== req.user.id) return res.status(403).json({ message: 'Akses ditolak' });

    await pool.query('DELETE FROM meeting_participants WHERE id = $1 AND meeting_id = $2', [req.params.participantId, req.params.id]);
    res.json({ message: 'Peserta berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/meetings/:id/attendance-link
router.get('/:id/attendance-link', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT attendance_token FROM meetings WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ message: 'Rapat tidak ditemukan' });

    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    res.json({
      token: result.rows[0].attendance_token,
      link: `${appUrl}/attend/${result.rows[0].attendance_token}`
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
