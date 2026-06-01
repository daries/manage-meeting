const express = require('express');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { sendEmail } = require('../services/emailService');
const { sendWhatsApp } = require('../services/whatsappService');
const { generateMinutesPDF } = require('../services/pdfService');

const router = express.Router();

// GET /api/minutes/:meetingId — get all minutes for a meeting
router.get('/:meetingId', authenticate, async (req, res) => {
  try {
    const access = await pool.query(`
      SELECT m.*, u.full_name as creator_name
      FROM meetings m
      LEFT JOIN meeting_participants mp ON m.id = mp.meeting_id
      LEFT JOIN users u ON m.created_by = u.id
      WHERE m.id = $1 AND (m.created_by = $2 OR mp.user_id = $2)
    `, [req.params.meetingId, req.user.id]);

    if (!access.rows[0]) return res.status(403).json({ message: 'Akses ditolak' });

    const minutes = await pool.query(`
      SELECT mm.*, a.title as agenda_title, a.order_number,
             u.full_name as created_by_name
      FROM meeting_minutes mm
      LEFT JOIN agendas a ON mm.agenda_id = a.id
      LEFT JOIN users u ON mm.created_by = u.id
      WHERE mm.meeting_id = $1
      ORDER BY a.order_number NULLS LAST, mm.created_at
    `, [req.params.meetingId]);

    const approvals = await pool.query(`
      SELECT ma.*, u.full_name, u.jabatan
      FROM minutes_approvals ma
      JOIN users u ON ma.user_id = u.id
      WHERE ma.meeting_id = $1
    `, [req.params.meetingId]);

    const participants = await pool.query(`
      SELECT mp.user_id, COALESCE(u.full_name, mp.external_name) as name, mp.role,
             COALESCE(mp.jabatan, u.jabatan) as jabatan
      FROM meeting_participants mp
      LEFT JOIN users u ON mp.user_id = u.id
      WHERE mp.meeting_id = $1 AND mp.user_id IS NOT NULL
    `, [req.params.meetingId]);

    res.json({
      meeting: access.rows[0],
      minutes: minutes.rows,
      approvals: approvals.rows,
      participants: participants.rows,
      userApproval: approvals.rows.find(a => a.user_id === req.user.id) || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/minutes/:meetingId — create/update minutes
router.post('/:meetingId', authenticate, async (req, res) => {
  const { agenda_id, summary, discussion, decisions, action_items } = req.body;

  try {
    const meetingCheck = await pool.query(`
      SELECT m.minutes_locked FROM meetings m
      LEFT JOIN meeting_participants mp ON m.id = mp.meeting_id
      WHERE m.id = $1 AND (m.created_by = $2 OR mp.user_id = $2)
    `, [req.params.meetingId, req.user.id]);

    if (!meetingCheck.rows[0]) return res.status(403).json({ message: 'Akses ditolak' });
    if (meetingCheck.rows[0].minutes_locked) {
      return res.status(403).json({ message: 'Notulen sudah final karena semua peserta telah menyetujui' });
    }

    // Upsert minutes
    const existing = await pool.query(
      'SELECT id FROM meeting_minutes WHERE meeting_id = $1 AND agenda_id IS NOT DISTINCT FROM $2',
      [req.params.meetingId, agenda_id || null]
    );

    let result;
    if (existing.rows[0]) {
      result = await pool.query(`
        UPDATE meeting_minutes SET summary=$1, discussion=$2, decisions=$3, action_items=$4, updated_at=NOW()
        WHERE id=$5 RETURNING *
      `, [summary, discussion, decisions, JSON.stringify(action_items || []), existing.rows[0].id]);
    } else {
      result = await pool.query(`
        INSERT INTO meeting_minutes (meeting_id, agenda_id, summary, discussion, decisions, action_items, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
      `, [req.params.meetingId, agenda_id || null, summary, discussion, decisions, JSON.stringify(action_items || []), req.user.id]);
    }

    // Reset approvals when minutes are updated
    await pool.query(
      'UPDATE minutes_approvals SET approved = false, approved_at = null WHERE meeting_id = $1',
      [req.params.meetingId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/minutes/:meetingId/approve — approve/reject minutes
router.post('/:meetingId/approve', authenticate, async (req, res) => {
  const { approved, notes } = req.body;

  try {
    // Check if participant
    const check = await pool.query(`
      SELECT mp.id FROM meeting_participants mp
      WHERE mp.meeting_id = $1 AND mp.user_id = $2
    `, [req.params.meetingId, req.user.id]);

    if (!check.rows[0]) return res.status(403).json({ message: 'Hanya peserta terdaftar yang bisa menyetujui' });

    // Upsert approval
    const result = await pool.query(`
      INSERT INTO minutes_approvals (meeting_id, user_id, approved, approved_at, notes)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (meeting_id, user_id)
      DO UPDATE SET approved = EXCLUDED.approved, approved_at = EXCLUDED.approved_at, notes = EXCLUDED.notes
      RETURNING *
    `, [req.params.meetingId, req.user.id, approved, approved ? new Date() : null, notes]);

    // Check if all registered participants have approved
    const totalParticipants = await pool.query(
      'SELECT COUNT(*) FROM meeting_participants WHERE meeting_id = $1 AND user_id IS NOT NULL',
      [req.params.meetingId]
    );

    const totalApprovals = await pool.query(
      'SELECT COUNT(*) FROM minutes_approvals WHERE meeting_id = $1 AND approved = true',
      [req.params.meetingId]
    );

    const total = parseInt(totalParticipants.rows[0].count);
    const approvedCount = parseInt(totalApprovals.rows[0].count);

    let locked = false;
    if (total > 0 && approvedCount >= total) {
      await pool.query(
        'UPDATE meetings SET minutes_locked = true, status = $1, updated_at = NOW() WHERE id = $2',
        ['completed', req.params.meetingId]
      );
      locked = true;
    }

    res.json({ approval: result.rows[0], locked, approvedCount, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/minutes/:meetingId/pdf — download notulen as PDF
router.get('/:meetingId/pdf', authenticate, async (req, res) => {
  try {
    const access = await pool.query(`
      SELECT m.*, u.full_name as creator_name
      FROM meetings m
      LEFT JOIN meeting_participants mp ON m.id = mp.meeting_id
      LEFT JOIN users u ON m.created_by = u.id
      WHERE m.id = $1 AND (m.created_by = $2 OR mp.user_id = $2)
    `, [req.params.meetingId, req.user.id]);

    if (!access.rows[0]) return res.status(403).json({ message: 'Akses ditolak' });

    const minutes = await pool.query(`
      SELECT mm.*, a.title as agenda_title, a.order_number
      FROM meeting_minutes mm
      LEFT JOIN agendas a ON mm.agenda_id = a.id
      WHERE mm.meeting_id = $1
      ORDER BY a.order_number NULLS LAST, mm.created_at
    `, [req.params.meetingId]);

    const approvals = await pool.query(`
      SELECT ma.*, u.full_name
      FROM minutes_approvals ma
      JOIN users u ON ma.user_id = u.id
      WHERE ma.meeting_id = $1
    `, [req.params.meetingId]);

    const participants = await pool.query(`
      SELECT mp.user_id, COALESCE(u.full_name, mp.external_name) as name,
             COALESCE(mp.jabatan, u.jabatan) as jabatan
      FROM meeting_participants mp
      LEFT JOIN users u ON mp.user_id = u.id
      WHERE mp.meeting_id = $1
    `, [req.params.meetingId]);

    const pdfBuffer = await generateMinutesPDF({
      meeting: access.rows[0],
      minutes: minutes.rows,
      approvals: approvals.rows,
      participants: participants.rows,
    });

    const safeName = access.rows[0].title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').slice(0, 50);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Notulen_${safeName}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal membuat PDF' });
  }
});

// POST /api/minutes/:meetingId/send-pdf — send notulen PDF via email to all participants
router.post('/:meetingId/send-pdf', authenticate, async (req, res) => {
  try {
    const meeting = await pool.query(`
      SELECT m.*, u.full_name as creator_name FROM meetings m
      LEFT JOIN users u ON m.created_by = u.id
      WHERE m.id = $1 AND m.created_by = $2
    `, [req.params.meetingId, req.user.id]);

    if (!meeting.rows[0]) return res.status(403).json({ message: 'Akses ditolak' });

    const minutes = await pool.query(`
      SELECT mm.*, a.title as agenda_title, a.order_number
      FROM meeting_minutes mm
      LEFT JOIN agendas a ON mm.agenda_id = a.id
      WHERE mm.meeting_id = $1
      ORDER BY a.order_number NULLS LAST, mm.created_at
    `, [req.params.meetingId]);

    const approvals = await pool.query(`
      SELECT ma.*, u.full_name
      FROM minutes_approvals ma
      JOIN users u ON ma.user_id = u.id
      WHERE ma.meeting_id = $1
    `, [req.params.meetingId]);

    const participants = await pool.query(`
      SELECT mp.user_id, COALESCE(u.full_name, mp.external_name) as name,
             u.email, mp.external_email,
             COALESCE(mp.jabatan, u.jabatan) as jabatan
      FROM meeting_participants mp
      LEFT JOIN users u ON mp.user_id = u.id
      WHERE mp.meeting_id = $1
    `, [req.params.meetingId]);

    const pdfBuffer = await generateMinutesPDF({
      meeting: meeting.rows[0],
      minutes: minutes.rows,
      approvals: approvals.rows,
      participants: participants.rows,
    });

    const safeName = meeting.rows[0].title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').slice(0, 50);
    const filename = `Notulen_${safeName}.pdf`;
    const results = [];

    for (const p of participants.rows) {
      const email = p.email || p.external_email;
      if (email) {
        results.push(await sendEmail(email, 'minutesPDF', {
          recipientName: p.name || 'Peserta',
          meetingTitle: meeting.rows[0].title,
          meetingId: meeting.rows[0].id,
          pdfBuffer,
          pdfFilename: filename,
        }));
      }
    }

    res.json({ message: 'PDF notulen berhasil dikirim', results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengirim PDF' });
  }
});

// POST /api/minutes/:meetingId/send-review — notify participants to review minutes
router.post('/:meetingId/send-review', authenticate, async (req, res) => {
  try {
    const meeting = await pool.query(`
      SELECT m.*, u.full_name as creator_name FROM meetings m
      LEFT JOIN users u ON m.created_by = u.id
      WHERE m.id = $1 AND m.created_by = $2
    `, [req.params.meetingId, req.user.id]);

    if (!meeting.rows[0]) return res.status(403).json({ message: 'Akses ditolak' });

    const participants = await pool.query(`
      SELECT mp.*, u.full_name, u.email, u.phone
      FROM meeting_participants mp
      LEFT JOIN users u ON mp.user_id = u.id
      WHERE mp.meeting_id = $1
    `, [req.params.meetingId]);

    const m = meeting.rows[0];
    const results = [];

    for (const p of participants.rows) {
      const name = p.full_name || p.external_name || 'Peserta';
      const email = p.email || p.external_email;
      const phone = p.phone || p.external_phone;
      const data = { recipientName: name, meetingTitle: m.title, meetingId: m.id };

      if (email) results.push(await sendEmail(email, 'minutesReview', data));
      if (phone) results.push(await sendWhatsApp(phone, 'minutesReview', data));
    }

    res.json({ message: 'Notifikasi review dikirim', results });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
