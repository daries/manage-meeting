const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Token tidak ditemukan' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');

    const result = await pool.query(
      'SELECT id, email, full_name, is_profile_complete, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!result.rows[0] || !result.rows[0].is_active) {
      return res.status(401).json({ message: 'User tidak valid' });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token sudah expired' });
    }
    return res.status(401).json({ message: 'Token tidak valid' });
  }
};

const requireProfileComplete = (req, res, next) => {
  if (!req.user.is_profile_complete) {
    return res.status(403).json({
      message: 'Silakan lengkapi data diri Anda terlebih dahulu',
      redirect: '/profile'
    });
  }
  next();
};

module.exports = { authenticate, requireProfileComplete };
