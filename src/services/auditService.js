const crypto = require('crypto');
const db = require('../db/db');

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

function computeEntryHash(previousHash, eventType, userId, metadataStr, createdAt) {
  const payload = `${previousHash}|${eventType}|${userId ?? 'SYSTEM'}|${metadataStr}|${createdAt}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Mencatat peristiwa penting ke audit_logs (Append-Only dengan Hash Chain)
 */
function logAudit(eventType, userId = null, metadata = {}) {
  try {
    const metadataStr = typeof metadata === 'string' ? metadata : JSON.stringify(metadata);
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // Ambil hash terakhir
    const lastEntry = db.prepare('SELECT log_hash FROM audit_logs ORDER BY id DESC LIMIT 1').get();
    const previousHash = lastEntry && lastEntry.log_hash ? lastEntry.log_hash : GENESIS_HASH;

    const logHash = computeEntryHash(previousHash, eventType, userId, metadataStr, now);

    const stmt = db.prepare(`
      INSERT INTO audit_logs (event_type, user_id, metadata, previous_hash, log_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(eventType, userId, metadataStr, previousHash, logHash, now);

    return {
      id: Number(result.lastInsertRowid),
      event_type: eventType,
      user_id: userId,
      log_hash: logHash,
      previous_hash: previousHash,
      created_at: now
    };
  } catch (err) {
    console.error('[AuditService] Gagal mencatat audit log:', err);
    throw err;
  }
}

/**
 * Memverifikasi seluruh rantai audit log untuk mendeteksi manipulasi data
 */
function verifyAuditLogIntegrity() {
  const rows = db.prepare('SELECT id, event_type, user_id, metadata, previous_hash, log_hash, created_at FROM audit_logs ORDER BY id ASC').all();

  if (rows.length === 0) {
    return {
      valid: true,
      totalEntries: 0,
      message: 'Belum ada catatan audit log.'
    };
  }

  let expectedPrevHash = GENESIS_HASH;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Cek apakah previous_hash sesuai dengan hash baris sebelumnya
    if (row.previous_hash !== expectedPrevHash) {
      return {
        valid: false,
        totalEntries: rows.length,
        brokenAtId: row.id,
        reason: `Ketidaksesuaian rantai hash pada entri #${row.id}. Previous hash tidak cocok.`
      };
    }

    // Hitung ulang hash baris saat ini
    const calculatedHash = computeEntryHash(
      row.previous_hash,
      row.event_type,
      row.user_id,
      row.metadata || '{}',
      row.created_at
    );

    if (calculatedHash !== row.log_hash) {
      return {
        valid: false,
        totalEntries: rows.length,
        brokenAtId: row.id,
        reason: `Manipulasi terdeteksi pada entri #${row.id}. Hash data tidak sesuai dengan konten tercatat.`
      };
    }

    expectedPrevHash = row.log_hash;
  }

  return {
    valid: true,
    totalEntries: rows.length,
    latestHash: expectedPrevHash,
    message: 'Seluruh rantai audit log valid dan terverifikasi secara kriptografis.'
  };
}

module.exports = {
  logAudit,
  verifyAuditLogIntegrity
};
