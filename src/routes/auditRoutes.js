const express = require('express');
const db = require('../db/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { csrfMiddleware } = require('../middleware/csrf');
const { verifyAuditLogIntegrity } = require('../services/auditService');

const router = express.Router();

// Auditor dan Admin dapat mengakses endpoint audit
router.use(requireAuth, requireRole(['admin', 'auditor']));

/**
 * Daftar Audit Logs (Append-only)
 */
router.get('/logs', (req, res) => {
  const { eventType, limit = 100, offset = 0 } = req.query;

  let sql = `
    SELECT a.id, a.event_type, a.user_id, u.name as user_name, u.voter_id, a.metadata, a.previous_hash, a.log_hash, a.created_at
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
  `;
  const params = [];

  if (eventType && eventType !== 'all') {
    sql += ' WHERE a.event_type = ?';
    params.push(eventType);
  }

  sql += ' ORDER BY a.id DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const logs = db.prepare(sql).all(...params);

  // Total count
  const countRow = db.prepare('SELECT COUNT(*) as count FROM audit_logs').get();

  res.json({
    success: true,
    total: countRow ? countRow.count : 0,
    logs
  });
});

/**
 * Verifikasi Integritas Kriptografis Rantai Audit Log
 */
router.post('/verify-integrity', csrfMiddleware, (req, res) => {
  try {
    const result = verifyAuditLogIntegrity();
    res.json({ success: true, verification: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Daftar Snapshots Hasil Pemilihan
 */
router.get('/snapshots', (req, res) => {
  const snapshots = db.prepare(`
    SELECT s.*, u.name as created_by_name
    FROM results_snapshots s
    LEFT JOIN users u ON s.created_by = u.id
    ORDER BY s.id DESC
  `).all();

  res.json({ success: true, snapshots });
});

module.exports = router;
