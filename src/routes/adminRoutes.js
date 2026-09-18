const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { csrfMiddleware } = require('../middleware/csrf');
const { logAudit } = require('../services/auditService');
const { getFraudEvents, updateFraudReview } = require('../services/antiFraudService');
const { createResultsSnapshot } = require('../services/votingService');

const router = express.Router();

// Seluruh endpoint di file ini mewajibkan peran Administrator
router.use(requireAuth, requireRole('admin'));

/**
 * Daftar Pemilih
 */
router.get('/voters', (req, res) => {
  const voters = db.prepare(`
    SELECT id, voter_id, name, role, has_voted, created_at
    FROM users
    WHERE role = 'voter'
    ORDER BY id ASC
  `).all();
  res.json({ success: true, voters });
});

/**
 * Tambah Pemilih Baru
 */
router.post('/voters', csrfMiddleware, (req, res) => {
  const { voter_id, name, password } = req.body;

  if (!voter_id || !name || !password) {
    return res.status(400).json({ success: false, error: 'ID Pemilih, Nama, dan Password wajib diisi.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE voter_id = ?').get(String(voter_id).trim());
  if (existing) {
    return res.status(400).json({ success: false, error: 'ID Pemilih sudah terdaftar di sistem.' });
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);

  const stmt = db.prepare(`
    INSERT INTO users (voter_id, name, password_hash, role, has_voted)
    VALUES (?, ?, ?, 'voter', 0)
  `);
  const result = stmt.run(String(voter_id).trim(), String(name).trim(), passwordHash);

  logAudit('VOTER_REGISTERED', req.session.user.id, {
    new_voter_id: voter_id,
    name
  });

  res.json({
    success: true,
    message: 'Pemilih baru berhasil ditambahkan.',
    voter: {
      id: Number(result.lastInsertRowid),
      voter_id,
      name,
      has_voted: 0
    }
  });
});

/**
 * Reset Password Pemilih
 */
router.post('/voters/:id/reset-password', csrfMiddleware, (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ success: false, error: 'Password baru minimal 6 karakter.' });
  }

  const user = db.prepare('SELECT id, voter_id, name FROM users WHERE id = ?').get(id);
  if (!user) {
    return res.status(404).json({ success: false, error: 'Pemilih tidak ditemukan.' });
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(newPassword, salt);

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id);

  logAudit('VOTER_PASSWORD_RESET', req.session.user.id, {
    target_user_id: user.id,
    voter_id: user.voter_id
  });

  res.json({ success: true, message: `Password untuk ${user.name} berhasil direset.` });
});

/**
 * Update Kandidat
 */
router.put('/candidates/:id', csrfMiddleware, (req, res) => {
  const { id } = req.params;
  const { name, vision, mission, programs } = req.body;

  const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(id);
  if (!candidate) {
    return res.status(404).json({ success: false, error: 'Kandidat tidak ditemukan.' });
  }

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const stmt = db.prepare(`
    UPDATE candidates
    SET name = ?, vision = ?, mission = ?, programs = ?, updated_at = ?
    WHERE id = ?
  `);
  stmt.run(name || candidate.name, vision || candidate.vision, mission || candidate.mission, programs || candidate.programs, now, id);

  logAudit('CANDIDATE_UPDATED', req.session.user.id, {
    candidate_id: id,
    name: name || candidate.name
  });

  res.json({ success: true, message: 'Data kandidat berhasil diperbarui.' });
});

/**
 * Ubah Pengaturan Pemilihan (Jadwal & Status)
 */
router.put('/election', csrfMiddleware, (req, res) => {
  const { name, startTime, endTime, status } = req.body;
  const validStatuses = ['draft', 'ongoing', 'closed', 'published'];

  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: 'Status pemilihan tidak valid.' });
  }

  const current = db.prepare('SELECT * FROM election_settings ORDER BY id ASC LIMIT 1').get();
  if (!current) {
    return res.status(404).json({ success: false, error: 'Pengaturan pemilihan belum ada.' });
  }

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const stmt = db.prepare(`
    UPDATE election_settings
    SET name = ?, start_time = ?, end_time = ?, status = ?, updated_at = ?
    WHERE id = ?
  `);
  stmt.run(
    name || current.name,
    startTime || current.start_time,
    endTime || current.end_time,
    status || current.status,
    now,
    current.id
  );

  logAudit('ELECTION_SETTING_CHANGED', req.session.user.id, {
    previous_status: current.status,
    new_status: status || current.status,
    name: name || current.name
  });

  res.json({ success: true, message: 'Pengaturan pemilihan berhasil disimpan.' });
});

/**
 * Buat Snapshot Resmi Hasil Pemilihan
 */
router.post('/election/snapshot', csrfMiddleware, (req, res) => {
  try {
    const snapshot = createResultsSnapshot(req.session.user.id);
    res.json({ success: true, message: 'Snapshot integritas hasil berhasil dibuat.', snapshot });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Ambil Daftar Kejadian Fraud
 */
router.get('/fraud-events', (req, res) => {
  const { severity, status, limit } = req.query;
  const events = getFraudEvents({ severity, status, limit: limit || 50 });
  res.json({ success: true, events });
});

/**
 * Perbarui Status Review Kejadian Fraud
 */
router.put('/fraud-events/:id', csrfMiddleware, (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;
  const validStatuses = ['unreviewed', 'investigating', 'resolved', 'dismissed'];

  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: 'Status review tidak valid.' });
  }

  try {
    const updated = updateFraudReview(id, {
      status,
      reviewedBy: req.session.user.id,
      notes: notes || ''
    });
    res.json({ success: true, message: 'Status review berhasil diperbarui.', event: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
