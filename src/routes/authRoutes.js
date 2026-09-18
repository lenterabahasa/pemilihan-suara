const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/db');
const { logAudit } = require('../services/auditService');
const { handleFailedLogin } = require('../services/antiFraudService');
const { loginRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

/**
 * Mendapatkan token CSRF untuk klien web
 */
router.get('/csrf-token', (req, res) => {
  res.json({ csrfToken: req.session.csrfToken });
});

/**
 * Login Pemilih, Administrator, atau Auditor
 */
router.post('/login', loginRateLimiter, (req, res) => {
  const { voter_id, password } = req.body;
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';

  if (!voter_id || !password) {
    return res.status(400).json({
      success: false,
      error: 'ID Pemilih / Username dan password wajib diisi.'
    });
  }

  const user = db.prepare('SELECT * FROM users WHERE voter_id = ?').get(String(voter_id).trim());

  if (!user) {
    handleFailedLogin(ip, voter_id);
    logAudit('LOGIN_FAILED', null, { voter_id, ip, reason: 'ID Pemilih tidak terdaftar' });
    return res.status(401).json({
      success: false,
      error: 'ID Pemilih atau password yang Anda masukkan salah.'
    });
  }

  const passwordMatch = bcrypt.compareSync(password, user.password_hash);
  if (!passwordMatch) {
    handleFailedLogin(ip, voter_id);
    logAudit('LOGIN_FAILED', user.id, { voter_id, ip, reason: 'Password salah' });
    return res.status(401).json({
      success: false,
      error: 'ID Pemilih atau password yang Anda masukkan salah.'
    });
  }

  // Regenerasi sesi untuk mencegah Session Fixation
  req.session.regenerate((err) => {
    if (err) {
      console.error('Session regenerate error:', err);
      return res.status(500).json({ success: false, error: 'Terjadi gangguan sesi internal.' });
    }

    req.session.user = {
      id: user.id,
      voter_id: user.voter_id,
      name: user.name,
      role: user.role,
      has_voted: user.has_voted
    };

    // Buat CSRF token baru untuk sesi ini
    const crypto = require('crypto');
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');

    const eventName = user.role === 'admin' ? 'ADMIN_LOGIN' : (user.role === 'auditor' ? 'AUDITOR_LOGIN' : 'LOGIN_SUCCESS');
    logAudit(eventName, user.id, {
      voter_id: user.voter_id,
      role: user.role,
      ip
    });

    res.json({
      success: true,
      message: 'Login berhasil.',
      user: req.session.user,
      csrfToken: req.session.csrfToken
    });
  });
});

/**
 * Logout
 */
router.post('/logout', (req, res) => {
  const userId = req.session && req.session.user ? req.session.user.id : null;
  const ip = req.ip || req.socket.remoteAddress;

  if (userId) {
    logAudit('LOGOUT', userId, { ip });
  }

  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Gagal keluar sesi.' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true, message: 'Berhasil keluar.' });
  });
});

/**
 * Cek sesi aktif
 */
router.get('/me', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.json({ authenticated: false });
  }

  // Ambil status has_voted terbaru dari DB
  const user = db.prepare('SELECT id, voter_id, name, role, has_voted FROM users WHERE id = ?').get(req.session.user.id);
  if (!user) {
    req.session.destroy();
    return res.json({ authenticated: false });
  }

  req.session.user.has_voted = user.has_voted;
  req.session.user.name = user.name;
  req.session.user.role = user.role;

  res.json({
    authenticated: true,
    user: req.session.user,
    csrfToken: req.session.csrfToken
  });
});

module.exports = router;
