const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { OAuth2Client } = require('google-auth-library');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { sendEmail } = require('../services/emailService');

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const APP_URL = process.env.APP_URL || 'http://localhost:5173';

function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

// POST /api/auth/register
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('full_name').trim().isLength({ min: 2 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password, full_name } = req.body;

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'Email sudah terdaftar' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const verificationToken = generateVerificationToken();
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 jam

    await pool.query(
      `INSERT INTO users (email, password_hash, full_name, email_verified, verification_token, verification_token_expires_at)
       VALUES ($1, $2, $3, false, $4, $5)`,
      [email, password_hash, full_name, verificationToken, tokenExpires]
    );

    const verificationUrl = `${APP_URL}/verify-email/${verificationToken}`;
    await sendEmail(email, 'emailVerification', { fullName: full_name, verificationUrl });

    res.status(201).json({ message: 'Pendaftaran berhasil! Cek email Anda untuk konfirmasi akun.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (!result.rows[0]) {
      return res.status(401).json({ message: 'Email atau password salah' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        message: 'Akun Anda tidak aktif. Silakan ajukan reaktivasi untuk mengaktifkan kembali.',
        code: 'ACCOUNT_INACTIVE',
        email: user.email,
      });
    }

    if (!user.password_hash) {
      return res.status(401).json({ message: 'Akun ini terdaftar via Google. Gunakan tombol "Masuk dengan Google".' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ message: 'Email atau password salah' });
    }

    if (!user.email_verified) {
      return res.status(403).json({
        message: 'Email belum diverifikasi. Cek inbox Anda dan klik link konfirmasi.',
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
      });
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: '7d' }
    );

    const { password_hash, ...userData } = user;
    res.json({ token, user: userData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, full_name, phone, jabatan, department, organization, avatar_url, is_profile_complete, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/auth/profile
router.put('/profile', authenticate, async (req, res) => {
  const { full_name, phone, jabatan, department, organization } = req.body;

  try {
    const isComplete = !!(full_name && phone && jabatan && department);
    const result = await pool.query(
      `UPDATE users SET full_name=$1, phone=$2, jabatan=$3, department=$4, organization=$5,
       is_profile_complete=$6, updated_at=NOW()
       WHERE id=$7
       RETURNING id, email, full_name, phone, jabatan, department, organization, is_profile_complete`,
      [full_name, phone, jabatan, department, organization, isComplete, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/auth/verify-email/:token
router.get('/verify-email/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM users
       WHERE verification_token = $1
         AND verification_token_expires_at > NOW()
         AND is_active = true`,
      [token]
    );

    if (!result.rows[0]) {
      return res.status(400).json({ message: 'Link konfirmasi tidak valid atau sudah kadaluarsa.' });
    }

    const user = result.rows[0];

    await pool.query(
      `UPDATE users
       SET email_verified = true, verification_token = NULL, verification_token_expires_at = NULL, updated_at = NOW()
       WHERE id = $1`,
      [user.id]
    );

    const jwtToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: '7d' }
    );

    const { password_hash, verification_token, ...userData } = user;
    res.json({ token: jwtToken, user: { ...userData, email_verified: true } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/resend-verification
router.post('/resend-verification', [
  body('email').isEmail().normalizeEmail(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email } = req.body;

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email]
    );

    // Selalu return sukses untuk mencegah email enumeration
    if (!result.rows[0] || result.rows[0].email_verified || result.rows[0].google_id) {
      return res.json({ message: 'Jika email terdaftar dan belum diverifikasi, link konfirmasi telah dikirim.' });
    }

    const user = result.rows[0];
    const verificationToken = generateVerificationToken();
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.query(
      `UPDATE users SET verification_token = $1, verification_token_expires_at = $2, updated_at = NOW()
       WHERE id = $3`,
      [verificationToken, tokenExpires, user.id]
    );

    const verificationUrl = `${APP_URL}/verify-email/${verificationToken}`;
    await sendEmail(email, 'emailVerification', { fullName: user.full_name || email, verificationUrl });

    res.json({ message: 'Link konfirmasi baru telah dikirim ke email Anda.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email } = req.body;
  // Selalu return sukses untuk mencegah email enumeration
  res.json({ message: 'Jika email terdaftar, link reset password telah dikirim.' });

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true AND password_hash IS NOT NULL',
      [email]
    );
    if (!result.rows[0]) return;

    const user = result.rows[0];
    const token = generateVerificationToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 jam

    await pool.query(
      `UPDATE users SET reset_token=$1, reset_token_type='password', reset_token_expires_at=$2, updated_at=NOW() WHERE id=$3`,
      [token, expires, user.id]
    );

    const resetUrl = `${APP_URL}/reset-password/${token}`;
    await sendEmail(email, 'forgotPassword', { fullName: user.full_name || email, resetUrl });
  } catch (err) {
    console.error('Forgot password error:', err);
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', [
  body('token').notEmpty(),
  body('password').isLength({ min: 6 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { token, password } = req.body;

  try {
    const result = await pool.query(
      `SELECT * FROM users
       WHERE reset_token = $1
         AND reset_token_type = 'password'
         AND reset_token_expires_at > NOW()
         AND is_active = true`,
      [token]
    );

    if (!result.rows[0]) {
      return res.status(400).json({ message: 'Link reset password tidak valid atau sudah kadaluarsa.' });
    }

    const user = result.rows[0];
    const password_hash = await bcrypt.hash(password, 12);

    await pool.query(
      `UPDATE users
       SET password_hash=$1, reset_token=NULL, reset_token_type=NULL, reset_token_expires_at=NULL, updated_at=NOW()
       WHERE id=$2`,
      [password_hash, user.id]
    );

    res.json({ message: 'Password berhasil direset. Silakan masuk dengan password baru.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/request-reactivation
router.post('/request-reactivation', [
  body('email').isEmail().normalizeEmail(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email } = req.body;
  res.json({ message: 'Jika akun Anda tidak aktif, link reaktivasi telah dikirim ke email.' });

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = false',
      [email]
    );
    if (!result.rows[0]) return;

    const user = result.rows[0];
    const token = generateVerificationToken();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 jam

    await pool.query(
      `UPDATE users SET reset_token=$1, reset_token_type='reactivation', reset_token_expires_at=$2, updated_at=NOW() WHERE id=$3`,
      [token, expires, user.id]
    );

    const reactivationUrl = `${APP_URL}/reactivate/${token}`;
    await sendEmail(email, 'reactivation', { fullName: user.full_name || email, reactivationUrl });
  } catch (err) {
    console.error('Request reactivation error:', err);
  }
});

// GET /api/auth/reactivate/:token
router.get('/reactivate/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM users
       WHERE reset_token = $1
         AND reset_token_type = 'reactivation'
         AND reset_token_expires_at > NOW()
         AND is_active = false`,
      [token]
    );

    if (!result.rows[0]) {
      return res.status(400).json({ message: 'Link reaktivasi tidak valid atau sudah kadaluarsa.' });
    }

    const user = result.rows[0];

    await pool.query(
      `UPDATE users
       SET is_active=true, reset_token=NULL, reset_token_type=NULL, reset_token_expires_at=NULL, updated_at=NOW()
       WHERE id=$1`,
      [user.id]
    );

    const jwtToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: '7d' }
    );

    const { password_hash, reset_token, verification_token, ...userData } = user;
    res.json({ token: jwtToken, user: { ...userData, is_active: true } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/google
router.post('/google', async (req, res) => {
  const { credential, access_token } = req.body;
  if (!credential && !access_token) {
    return res.status(400).json({ message: 'Token Google tidak ditemukan' });
  }

  try {
    let googleId, email, name, picture;

    if (credential) {
      // ID token flow (GoogleLogin component)
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      ({ sub: googleId, email, name, picture } = payload);
    } else {
      // Access token flow (useGoogleLogin hook)
      const response = await fetch(
        `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${access_token}`
      );
      if (!response.ok) throw new Error('Invalid access token');
      const data = await response.json();
      googleId = data.sub;
      email = data.email;
      name = data.name;
      picture = data.picture;
    }

    // Cari user berdasarkan google_id atau email
    let result = await pool.query(
      'SELECT * FROM users WHERE google_id = $1 OR email = $2',
      [googleId, email]
    );

    let user;
    if (result.rows.length > 0) {
      user = result.rows[0];
      // Update google_id dan avatar jika belum ada
      if (!user.google_id) {
        await pool.query(
          'UPDATE users SET google_id=$1, avatar_url=COALESCE(avatar_url,$2), updated_at=NOW() WHERE id=$3',
          [googleId, picture, user.id]
        );
        user.google_id = googleId;
      }
    } else {
      // Buat user baru via Google — langsung verified
      const newUser = await pool.query(
        `INSERT INTO users (email, google_id, full_name, avatar_url, is_active, email_verified)
         VALUES ($1, $2, $3, $4, true, true)
         RETURNING id, email, full_name, avatar_url, is_profile_complete, email_verified`,
        [email, googleId, name, picture]
      );
      user = newUser.rows[0];
    }

    if (!user.is_active) {
      return res.status(403).json({ message: 'Akun tidak aktif' });
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: '7d' }
    );

    const { password_hash, ...userData } = user;
    res.json({ token, user: userData });
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(401).json({ message: 'Token Google tidak valid' });
  }
});

// PUT /api/auth/change-password
router.put('/change-password', authenticate, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password || new_password.length < 6) {
    return res.status(400).json({ message: 'Data tidak valid' });
  }

  try {
    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(current_password, result.rows[0].password_hash);
    if (!valid) {
      return res.status(400).json({ message: 'Password lama tidak sesuai' });
    }

    const newHash = await bcrypt.hash(new_password, 12);
    await pool.query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [newHash, req.user.id]);
    res.json({ message: 'Password berhasil diubah' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
