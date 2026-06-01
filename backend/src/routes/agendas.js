const express = require('express');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { sendWhatsApp } = require('../services/whatsappService');

const router = express.Router();

// GET /api/agendas/:meetingId
router.get('/:meetingId', authenticate, async (req, res) => {
  try {
    const access = await pool.query(`
      SELECT m.id FROM meetings m
      LEFT JOIN meeting_participants mp ON m.id = mp.meeting_id
      WHERE m.id = $1 AND (m.created_by = $2 OR mp.user_id = $2)
    `, [req.params.meetingId, req.user.id]);

    if (!access.rows[0]) return res.status(403).json({ message: 'Akses ditolak' });

    const result = await pool.query(`
      SELECT a.*, u.full_name as pic_full_name, u.email as pic_email, u.phone as pic_phone
      FROM agendas a
      LEFT JOIN users u ON a.pic_user_id = u.id
      WHERE a.meeting_id = $1
      ORDER BY a.order_number
    `, [req.params.meetingId]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/agendas/:meetingId
router.post('/:meetingId', authenticate, async (req, res) => {
  const { title, description, duration_minutes, pic_user_id, pic_name } = req.body;

  try {
    const check = await pool.query('SELECT created_by FROM meetings WHERE id = $1', [req.params.meetingId]);
    if (!check.rows[0]) return res.status(404).json({ message: 'Rapat tidak ditemukan' });
    if (check.rows[0].created_by !== req.user.id) return res.status(403).json({ message: 'Akses ditolak' });

    const maxOrder = await pool.query(
      'SELECT COALESCE(MAX(order_number), 0) as max_order FROM agendas WHERE meeting_id = $1',
      [req.params.meetingId]
    );

    const result = await pool.query(`
      INSERT INTO agendas (meeting_id, order_number, title, description, duration_minutes, pic_user_id, pic_name)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `, [req.params.meetingId, maxOrder.rows[0].max_order + 1, title, description, duration_minutes || null, pic_user_id || null, pic_name]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/agendas/:meetingId/:agendaId
router.put('/:meetingId/:agendaId', authenticate, async (req, res) => {
  const { title, description, duration_minutes, pic_user_id, pic_name, status } = req.body;

  try {
    const check = await pool.query('SELECT created_by FROM meetings WHERE id = $1', [req.params.meetingId]);
    if (check.rows[0].created_by !== req.user.id) return res.status(403).json({ message: 'Akses ditolak' });

    const result = await pool.query(`
      UPDATE agendas SET title=$1, description=$2, duration_minutes=$3, pic_user_id=$4, pic_name=$5,
        status=COALESCE($6, status), updated_at=NOW()
      WHERE id=$7 AND meeting_id=$8 RETURNING *
    `, [title, description, duration_minutes || null, pic_user_id || null, pic_name, status, req.params.agendaId, req.params.meetingId]);

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/agendas/:meetingId/:agendaId
router.delete('/:meetingId/:agendaId', authenticate, async (req, res) => {
  try {
    const check = await pool.query('SELECT created_by FROM meetings WHERE id = $1', [req.params.meetingId]);
    if (check.rows[0].created_by !== req.user.id) return res.status(403).json({ message: 'Akses ditolak' });

    await pool.query('DELETE FROM agendas WHERE id = $1 AND meeting_id = $2', [req.params.agendaId, req.params.meetingId]);
    res.json({ message: 'Agenda berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/agendas/:meetingId/notify-pic — send WA reminder to PIC
router.post('/:meetingId/notify-pic', authenticate, async (req, res) => {
  try {
    const meeting = await pool.query(`
      SELECT m.*, u.full_name as creator_name FROM meetings m
      LEFT JOIN users u ON m.created_by = u.id
      WHERE m.id = $1 AND m.created_by = $2
    `, [req.params.meetingId, req.user.id]);

    if (!meeting.rows[0]) return res.status(403).json({ message: 'Akses ditolak' });

    const agendas = await pool.query(`
      SELECT a.*, u.full_name, u.phone
      FROM agendas a
      LEFT JOIN users u ON a.pic_user_id = u.id
      WHERE a.meeting_id = $1 AND u.phone IS NOT NULL
      ORDER BY a.order_number
    `, [req.params.meetingId]);

    // Group agendas by PIC
    const picMap = {};
    for (const a of agendas.rows) {
      if (!picMap[a.pic_user_id]) {
        picMap[a.pic_user_id] = { name: a.full_name, phone: a.phone, agendas: [] };
      }
      picMap[a.pic_user_id].agendas.push(a);
    }

    const m = meeting.rows[0];
    const dateStr = new Date(m.meeting_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const results = [];

    for (const [userId, pic] of Object.entries(picMap)) {
      const result = await sendWhatsApp(pic.phone, 'agendaReminder', {
        recipientName: pic.name,
        meetingTitle: m.title,
        meetingDate: dateStr,
        startTime: m.start_time,
        agendas: pic.agendas,
      });
      results.push({ to: pic.phone, name: pic.name, ...result });
    }

    res.json({ message: 'Notifikasi agenda dikirim', results });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/agendas/:meetingId/reorder
router.put('/:meetingId/reorder', authenticate, async (req, res) => {
  const { order } = req.body; // array of { id, order_number }

  try {
    const check = await pool.query('SELECT created_by FROM meetings WHERE id = $1', [req.params.meetingId]);
    if (check.rows[0].created_by !== req.user.id) return res.status(403).json({ message: 'Akses ditolak' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const item of order) {
        await client.query(
          'UPDATE agendas SET order_number = $1 WHERE id = $2 AND meeting_id = $3',
          [item.order_number, item.id, req.params.meetingId]
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.json({ message: 'Urutan agenda diperbarui' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
