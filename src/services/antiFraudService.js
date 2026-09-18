const db = require('../db/db');
const { logAudit } = require('./auditService');

// Penyimpanan sementara dalam memori untuk mendeteksi pola lonjakan atau brute force
const failedLoginsByIp = new Map();
const failedLoginsByVoterId = new Map();

const WINDOW_MS = 5 * 60 * 1000; // 5 menit

function cleanOldAttempts(map) {
  const now = Date.now();
  for (const [key, attempts] of map.entries()) {
    const validAttempts = attempts.filter(ts => now - ts < WINDOW_MS);
    if (validAttempts.length === 0) {
      map.delete(key);
    } else {
      map.set(key, validAttempts);
    }
  }
}

/**
 * Mencatat insiden ke tabel fraud_events dan audit_logs
 */
function recordFraudEvent({ eventType, severity, description, userId = null, metadata = {} }) {
  try {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const stmt = db.prepare(`
      INSERT INTO fraud_events (event_type, severity, description, status, created_at)
      VALUES (?, ?, ?, 'unreviewed', ?)
    `);
    const res = stmt.run(eventType, severity, description, now);

    // Otomatis sinkronkan juga ke audit log
    logAudit('FRAUD_EVENT_RECORDED', userId, {
      fraud_event_id: Number(res.lastInsertRowid),
      eventType,
      severity,
      description,
      ...metadata
    });

    return {
      id: Number(res.lastInsertRowid),
      eventType,
      severity,
      description,
      status: 'unreviewed',
      created_at: now
    };
  } catch (err) {
    console.error('[AntiFraudService] Gagal mencatat fraud event:', err);
    throw err;
  }
}

/**
 * Deteksi Kegagalan Login Berulang (Brute Force / Credential Stuffing)
 */
function handleFailedLogin(ip, voterId) {
  const now = Date.now();
  cleanOldAttempts(failedLoginsByIp);
  cleanOldAttempts(failedLoginsByVoterId);

  // Catat percobaan per IP
  const ipAttempts = failedLoginsByIp.get(ip) || [];
  ipAttempts.push(now);
  failedLoginsByIp.set(ip, ipAttempts);

  // Catat percobaan per voterId jika ada
  let voterAttempts = [];
  if (voterId) {
    voterAttempts = failedLoginsByVoterId.get(voterId) || [];
    voterAttempts.push(now);
    failedLoginsByVoterId.set(voterId, voterAttempts);
  }

  const totalIpFails = ipAttempts.length;
  const totalVoterFails = voterAttempts.length;

  if (totalIpFails >= 5 || totalVoterFails >= 5) {
    recordFraudEvent({
      eventType: 'BRUTE_FORCE_LOGIN_ATTEMPT',
      severity: 'suspicious',
      description: `Percobaan login gagal berulang kali (${Math.max(totalIpFails, totalVoterFails)}x) terdeteksi dari IP: ${ip}, ID Pemilih: ${voterId || 'tidak dikenal'} dalam 5 menit terakhir.`,
      metadata: { ip, voterId, totalIpFails, totalVoterFails }
    });
  } else if (totalIpFails >= 3 || totalVoterFails >= 3) {
    recordFraudEvent({
      eventType: 'SUSPICIOUS_LOGIN_ATTEMPTS',
      severity: 'review',
      description: `Terdeteksi 3 kali login gagal berturut-turut untuk akun ${voterId || 'anonim'} dari IP: ${ip}. Perlu ditinjau jika berlanjut.`,
      metadata: { ip, voterId, totalIpFails, totalVoterFails }
    });
  }
}

/**
 * Deteksi dan Blokir Percobaan Suara Ganda (Double Vote Prevention)
 */
function handleDuplicateVoteAttempt(user, ip) {
  const description = `Percobaan pemungutan suara kedua diblokir untuk pemilih: ${user.name} (ID: ${user.voter_id}) dari IP: ${ip}. Akun ini sudah memiliki status 'has_voted = 1'.`;

  recordFraudEvent({
    eventType: 'DUPLICATE_VOTE_BLOCKED',
    severity: 'suspicious',
    userId: user.id,
    description,
    metadata: { userId: user.id, voter_id: user.voter_id, ip }
  });

  logAudit('DUPLICATE_VOTE_BLOCKED', user.id, {
    voter_id: user.voter_id,
    ip,
    message: 'Upaya memilih kembali digagalkan oleh sistem'
  });
}

/**
 * Deteksi Akses Endpoint Tidak Sah (Privilege Escalation Attempt)
 */
function handleUnauthorizedAccess(req, expectedRole) {
  const ip = req.ip || req.socket.remoteAddress;
  const userId = req.session && req.session.user ? req.session.user.id : null;
  const currentRole = req.session && req.session.user ? req.session.user.role : 'tamu (tanpa login)';

  recordFraudEvent({
    eventType: 'UNAUTHORIZED_ACCESS_ATTEMPT',
    severity: 'review',
    userId,
    description: `Percobaan akses endpoint terproteksi ${req.originalUrl} oleh pengguna berstatus '${currentRole}' (memerlukan hak akses '${expectedRole}') dari IP: ${ip}.`,
    metadata: { path: req.originalUrl, method: req.method, ip, currentRole, expectedRole }
  });

  logAudit('UNAUTHORIZED_ACCESS_BLOCKED', userId, {
    path: req.originalUrl,
    ip,
    currentRole,
    expectedRole
  });
}

/**
 * Mengambil daftar kejadian fraud dengan filter opsional
 */
function getFraudEvents({ severity, status, limit = 50 } = {}) {
  let query = 'SELECT * FROM fraud_events';
  const conditions = [];
  const params = [];

  if (severity && severity !== 'all') {
    conditions.push('severity = ?');
    params.push(severity);
  }

  if (status && status !== 'all') {
    conditions.push('status = ?');
    params.push(status);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY id DESC LIMIT ?';
  params.push(Number(limit));

  return db.prepare(query).all(...params);
}

/**
 * Memperbarui status review suatu kejadian fraud
 */
function updateFraudReview(id, { status, reviewedBy, notes }) {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const stmt = db.prepare(`
    UPDATE fraud_events
    SET status = ?, reviewed_at = ?, reviewed_by = ?, review_notes = ?
    WHERE id = ?
  `);
  stmt.run(status, now, reviewedBy, notes, id);

  logAudit('FRAUD_EVENT_REVIEWED', reviewedBy, {
    fraud_event_id: id,
    new_status: status,
    notes
  });

  return db.prepare('SELECT * FROM fraud_events WHERE id = ?').get(id);
}

module.exports = {
  recordFraudEvent,
  handleFailedLogin,
  handleDuplicateVoteAttempt,
  handleUnauthorizedAccess,
  getFraudEvents,
  updateFraudReview
};
