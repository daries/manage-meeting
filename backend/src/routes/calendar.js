const express = require('express');
const crypto  = require('crypto');
const ical    = require('ical-generator');
const nodeIcal = require('node-ical');
const pool    = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const APP_URL = process.env.APP_URL || 'http://localhost:5173';

function calendarToken(userId) {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'rapatku_secret')
    .update(String(userId))
    .digest('hex')
    .slice(0, 40);
}

function buildEventDates(meeting) {
  const dateStr = meeting.meeting_date instanceof Date
    ? meeting.meeting_date.toISOString().slice(0, 10)
    : String(meeting.meeting_date).slice(0, 10);

  const start = new Date(`${dateStr}T${meeting.start_time}`);
  const end   = meeting.end_time
    ? new Date(`${dateStr}T${meeting.end_time}`)
    : new Date(start.getTime() + 60 * 60 * 1000);
  return { start, end };
}

// GET /api/calendar/token — get user's iCal subscription token
router.get('/token', authenticate, (req, res) => {
  const token = calendarToken(req.user.id);
  const url   = `${process.env.APP_URL?.replace('5173', '3001') || 'http://localhost:3001'}/api/calendar/ics/${token}`;
  res.json({ token, url });
});

// GET /api/calendar/ics/:token — public iCal feed (no auth, token-based)
router.get('/ics/:token', async (req, res) => {
  try {
    const user = await pool.query(
      'SELECT id, full_name FROM users',
    );
    const match = user.rows.find(u => calendarToken(u.id) === req.params.token);
    if (!match) return res.status(404).send('Calendar not found');

    const meetings = await pool.query(`
      SELECT m.* FROM meetings m
      LEFT JOIN meeting_participants mp ON m.id = mp.meeting_id
      WHERE m.created_by = $1 OR mp.user_id = $1
      ORDER BY m.meeting_date
    `, [match.id]);

    const agendas = meetings.rows.length
      ? await pool.query(`
          SELECT * FROM agendas WHERE meeting_id = ANY($1) ORDER BY order_number
        `, [meetings.rows.map(m => m.id)])
      : { rows: [] };

    const cal = ical.default({ name: `RapatKu – ${match.full_name}`, timezone: 'Asia/Jakarta' });

    meetings.rows.forEach(m => {
      const { start, end } = buildEventDates(m);
      const meetingAgendas = agendas.rows.filter(a => a.meeting_id === m.id);
      const description = [
        m.description || '',
        meetingAgendas.length ? '\nAgenda:\n' + meetingAgendas.map((a, i) => `${i + 1}. ${a.title}`).join('\n') : '',
      ].filter(Boolean).join('\n').trim();

      cal.createEvent({
        id:          m.id,
        start,
        end,
        summary:     m.title,
        description: description || undefined,
        location:    m.location || m.online_link || undefined,
        url:         `${APP_URL}/meetings/${m.id}`,
      });
    });

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="rapatku.ics"');
    res.send(cal.toString());
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// GET /api/calendar/external — list user's external calendars
router.get('/external', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, color, last_synced, created_at FROM external_calendars WHERE user_id = $1 ORDER BY created_at',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/calendar/external — add external calendar
router.post('/external', authenticate, async (req, res) => {
  const { name, ical_url, color } = req.body;
  if (!name || !ical_url) return res.status(400).json({ message: 'Nama dan URL iCal wajib diisi' });

  try {
    // Validate URL is reachable and parseable
    await nodeIcal.async.fromURL(ical_url);

    const result = await pool.query(
      'INSERT INTO external_calendars (user_id, name, ical_url, color, last_synced) VALUES ($1,$2,$3,$4,NOW()) RETURNING id, name, color, last_synced, created_at',
      [req.user.id, name, ical_url, color || '#10B981']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: 'URL iCal tidak valid atau tidak bisa diakses' });
  }
});

// DELETE /api/calendar/external/:id
router.delete('/external/:id', authenticate, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM external_calendars WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Kalender dihapus' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/calendar/external/:id/events — fetch events from external calendar
router.get('/external/:id/events', authenticate, async (req, res) => {
  try {
    const cal = await pool.query(
      'SELECT * FROM external_calendars WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!cal.rows[0]) return res.status(404).json({ message: 'Kalender tidak ditemukan' });

    const rawEvents = await nodeIcal.async.fromURL(cal.rows[0].ical_url);

    // Update last_synced
    await pool.query(
      'UPDATE external_calendars SET last_synced = NOW() WHERE id = $1',
      [req.params.id]
    );

    const events = Object.values(rawEvents)
      .filter(e => e.type === 'VEVENT' && e.start)
      .map(e => ({
        id:    e.uid || String(Math.random()),
        title: e.summary || '(Tanpa judul)',
        start: new Date(e.start),
        end:   e.end ? new Date(e.end) : new Date(new Date(e.start).getTime() + 3600000),
        location:    e.location || '',
        description: e.description || '',
        calendarId:  cal.rows[0].id,
        calendarName: cal.rows[0].name,
        color:       cal.rows[0].color,
        external:    true,
      }));

    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: 'Gagal mengambil event dari kalender eksternal' });
  }
});

module.exports = router;
