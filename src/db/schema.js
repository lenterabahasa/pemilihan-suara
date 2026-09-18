const db = require('./db');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      voter_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'voter', -- 'voter', 'admin', 'auditor'
      has_voted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_number INTEGER UNIQUE NOT NULL,
      name TEXT NOT NULL,
      photo TEXT NOT NULL,
      vision TEXT NOT NULL,
      mission TEXT NOT NULL,
      programs TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- Kerahasiaan Suara: Tabel votes sengaja TIDAK memiliki kolom user_id / voter_id!
    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id INTEGER NOT NULL REFERENCES candidates(id),
      vote_token TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS election_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ongoing', -- 'draft', 'ongoing', 'closed', 'published'
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- Audit Log dengan Cryptographic Hash Chaining
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      user_id INTEGER,
      metadata TEXT,
      previous_hash TEXT,
      log_hash TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- Fraud Detection Events
    CREATE TABLE IF NOT EXISTS fraud_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      severity TEXT NOT NULL, -- 'normal', 'review', 'suspicious'
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'unreviewed', -- 'unreviewed', 'investigating', 'resolved', 'dismissed'
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      reviewed_at TEXT,
      reviewed_by INTEGER,
      review_notes TEXT
    );

    -- Snapshot Integritas Hasil Pemilihan saat ditutup
    CREATE TABLE IF NOT EXISTS results_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      election_id INTEGER,
      total_voters INTEGER NOT NULL,
      total_votes INTEGER NOT NULL,
      turnout_percentage REAL NOT NULL,
      breakdown_json TEXT NOT NULL,
      integrity_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      created_by INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_users_voter_id ON users(voter_id);
    CREATE INDEX IF NOT EXISTS idx_votes_candidate ON votes(candidate_id);
    CREATE INDEX IF NOT EXISTS idx_audit_event ON audit_logs(event_type);
    CREATE INDEX IF NOT EXISTS idx_fraud_severity ON fraud_events(severity, status);
  `);
}

module.exports = { initSchema };
