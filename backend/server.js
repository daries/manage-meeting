require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

// Middleware
if (!isProd) {
  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  }));
}
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/meetings', require('./src/routes/meetings'));
app.use('/api/attendance', require('./src/routes/attendance'));
app.use('/api/minutes', require('./src/routes/minutes'));
app.use('/api/agendas', require('./src/routes/agendas'));
app.use('/api/users', require('./src/routes/users'));
app.use('/api/calendar', require('./src/routes/calendar'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Cron: Send meeting reminders — runs every hour
cron.schedule('0 * * * *', async () => {
  const pool = require('./src/config/db');
  const { sendEmail } = require('./src/services/emailService');
  const { sendWhatsApp } = require('./src/services/whatsappService');

  try {
    // Find meetings starting in 24 hours (reminder H-1)
    const tomorrow = await pool.query(`
      SELECT m.*, mp.user_id, u.full_name, u.email, u.phone,
             mp.external_email, mp.external_name, mp.external_phone
      FROM meetings m
      JOIN meeting_participants mp ON m.id = mp.meeting_id
      LEFT JOIN users u ON mp.user_id = u.id
      WHERE m.status = 'scheduled'
        AND m.meeting_date = CURRENT_DATE + INTERVAL '1 day'
        AND EXTRACT(HOUR FROM m.start_time) = EXTRACT(HOUR FROM NOW())
    `);

    for (const row of tomorrow.rows) {
      const name = row.full_name || row.external_name || 'Peserta';
      const email = row.email || row.external_email;
      const phone = row.phone || row.external_phone;
      const dateStr = new Date(row.meeting_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      const data = {
        recipientName: name,
        meetingTitle: row.title,
        meetingDate: dateStr,
        startTime: row.start_time,
        endTime: row.end_time,
        location: row.location,
        onlineLink: row.online_link,
        attendanceToken: row.attendance_token,
        timeLeft: 'besok',
      };

      if (email) await sendEmail(email, 'reminder', data);
      if (phone) await sendWhatsApp(phone, 'reminder', data);
    }
  } catch (err) {
    console.error('Cron reminder error:', err);
  }
});

// Production: serve frontend dist & SPA fallback
if (isProd) {
  const distPath = path.join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

app.listen(PORT, () => {
  const mode = isProd ? 'PRODUCTION' : 'DEVELOPMENT';
  console.log(`[${mode}] Server berjalan di http://localhost:${PORT}`);
  if (isProd) console.log(`Frontend served dari ../frontend/dist`);
});

module.exports = app;
