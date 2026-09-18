const crypto = require('crypto');
const db = require('../db/db');
const { logAudit } = require('./auditService');
const { handleDuplicateVoteAttempt, recordFraudEvent } = require('./antiFraudService');

/**
 * Mengambil pengaturan pemilihan saat ini
 */
function getElectionSettings() {
  const setting = db.prepare('SELECT * FROM election_settings ORDER BY id ASC LIMIT 1').get();
  if (!setting) {
    throw new Error('Pengaturan pemilihan belum diinisialisasi.');
  }
  return setting;
}

/**
 * Mengambil daftar kandidat untuk bilik suara
 */
function getCandidates() {
  return db.prepare('SELECT id, candidate_number, name, photo, vision, mission, programs FROM candidates ORDER BY candidate_number ASC').all();
}

/**
 * Pemungutan suara dengan Transaksi Atomik (ACID) dan Prinsip Kerahasiaan Suara
 */
function castVote(userId, candidateId, ip = '127.0.0.1') {
  const settings = getElectionSettings();

  // Validasi status pemilihan
  if (settings.status !== 'ongoing') {
    recordFraudEvent({
      eventType: 'VOTE_OUTSIDE_SCHEDULE',
      severity: 'review',
      userId,
      description: `Percobaan pemungutan suara saat status pemilihan adalah '${settings.status}' dari IP: ${ip}.`,
      metadata: { userId, status: settings.status, ip }
    });
    throw new Error(`Pemilihan saat ini berstatus '${settings.status}'. Pemungutan suara hanya dapat dilakukan saat pemilihan berstatus 'ongoing'.`);
  }

  // Validasi batas waktu jika diatur
  const nowStr = new Date().toISOString();
  if (settings.start_time && nowStr < settings.start_time) {
    throw new Error('Pemilihan belum dibuka.');
  }
  if (settings.end_time && nowStr > settings.end_time) {
    throw new Error('Waktu pemilihan telah berakhir.');
  }

  // Validasi kandidat
  const candidate = db.prepare('SELECT id, name FROM candidates WHERE id = ?').get(candidateId);
  if (!candidate) {
    throw new Error('Kandidat yang dipilih tidak valid.');
  }

  // TRANSAKSI ATOMIK DATABASE
  db.exec('BEGIN IMMEDIATE TRANSACTION;');

  try {
    const user = db.prepare('SELECT id, voter_id, name, role, has_voted FROM users WHERE id = ?').get(userId);

    if (!user) {
      throw new Error('Data pemilih tidak ditemukan.');
    }

    if (user.role !== 'voter') {
      throw new Error('Hanya akun dengan peran Pemilih yang dapat memberikan suara.');
    }

    // PENCEGAHAN SUARA GANDA
    if (user.has_voted === 1) {
      // Rollback segera
      db.exec('ROLLBACK;');
      handleDuplicateVoteAttempt(user, ip);
      throw new Error('Peringatan: Anda sudah pernah memberikan suara! Setiap pemilih hanya berhak atas satu suara.');
    }

    // KERAHASIAAN SUARA:
    // Buat token tanda terima kriptografis acak yang TIDAK berelasi dengan data pribadi pemilih
    const voteToken = 'VOTE-' + crypto.randomBytes(12).toString('hex').toUpperCase();
    const voteTime = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // 1. Simpan suara ke tabel votes (HANYA candidate_id dan vote_token - TANPA user_id!)
    const insertVoteStmt = db.prepare('INSERT INTO votes (candidate_id, vote_token, created_at) VALUES (?, ?, ?)');
    insertVoteStmt.run(candidateId, voteToken, voteTime);

    // 2. Tandai akun pemilih bahwa dia telah menggunakan hak suaranya
    const updateUserStmt = db.prepare('UPDATE users SET has_voted = 1 WHERE id = ?');
    updateUserStmt.run(userId);

    // 3. Catat audit log pemungutan suara (TIDAK membocorkan kandidat yang dipilih demi kerahasiaan suara)
    logAudit('VOTE_CAST', userId, {
      voter_id: user.voter_id,
      ip,
      status: 'SUKSES_TERCATAT',
      note: 'Suara tersimpan secara atomik dan anonim'
    });

    // Commit transaksi
    db.exec('COMMIT;');

    return {
      success: true,
      message: 'Suara Anda berhasil tercatat secara sah dan rahasia.',
      receiptToken: voteToken,
      timestamp: voteTime
    };
  } catch (err) {
    try {
      db.exec('ROLLBACK;');
    } catch (_) {}
    throw err;
  }
}

/**
 * Mengambil rekapitulasi hasil dan statistik partisipasi
 */
function getResults(userRole = 'voter') {
  const settings = getElectionSettings();
  const isPrivileged = userRole === 'admin' || userRole === 'auditor';

  // Jika pemilih biasa atau tamu, hanya boleh melihat jika status sudah 'published'
  if (!isPrivileged && settings.status !== 'published') {
    // Ambil statistik partisipasi publik tanpa rincian suara
    const totalVotersRow = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'voter'").get();
    const totalVotedRow = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'voter' AND has_voted = 1").get();
    const totalVoters = totalVotersRow ? totalVotersRow.count : 0;
    const totalVoted = totalVotedRow ? totalVotedRow.count : 0;

    return {
      published: false,
      status: settings.status,
      electionName: settings.name,
      message: 'Hasil pemilihan resmi akan dipublikasikan setelah seluruh proses pemungutan suara dan rekapitulasi selesai.',
      participation: {
        totalVoters,
        totalVoted,
        turnoutPercentage: totalVoters > 0 ? Number(((totalVoted / totalVoters) * 100).toFixed(2)) : 0
      }
    };
  }

  // Hitung hasil agregat
  const totalVotersRow = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'voter'").get();
  const totalVotedRow = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'voter' AND has_voted = 1").get();
  const totalVotesRow = db.prepare('SELECT COUNT(*) as count FROM votes').get();

  const totalVoters = totalVotersRow ? totalVotersRow.count : 0;
  const totalVoted = totalVotedRow ? totalVotedRow.count : 0;
  const totalVotes = totalVotesRow ? totalVotesRow.count : 0;
  const totalNonVoters = Math.max(0, totalVoters - totalVoted);
  const turnoutPercentage = totalVoters > 0 ? Number(((totalVoted / totalVoters) * 100).toFixed(2)) : 0;

  // Rincian suara per kandidat
  const candidates = db.prepare(`
    SELECT 
      c.id, 
      c.candidate_number, 
      c.name, 
      c.photo,
      COUNT(v.id) as vote_count
    FROM candidates c
    LEFT JOIN votes v ON c.id = v.candidate_id
    GROUP BY c.id
    ORDER BY c.candidate_number ASC
  `).all();

  const candidateResults = candidates.map(c => {
    const votes = Number(c.vote_count || 0);
    const percentage = totalVotes > 0 ? Number(((votes / totalVotes) * 100).toFixed(2)) : 0;
    return {
      id: c.id,
      candidateNumber: c.candidate_number,
      name: c.name,
      photo: c.photo,
      voteCount: votes,
      percentage
    };
  });

  // Cek snapshot terakhir jika ada
  const latestSnapshot = db.prepare('SELECT * FROM results_snapshots ORDER BY id DESC LIMIT 1').get();

  return {
    published: true,
    isPrivileged,
    status: settings.status,
    electionName: settings.name,
    totalVoters,
    totalVoted,
    totalVotes,
    totalNonVoters,
    turnoutPercentage,
    candidates: candidateResults,
    dataIntegrity: {
      isConsistent: totalVoted === totalVotes,
      votersMarked: totalVoted,
      ballotsInBox: totalVotes,
      latestSnapshot: latestSnapshot ? {
        id: latestSnapshot.id,
        createdAt: latestSnapshot.created_at,
        integrityHash: latestSnapshot.integrity_hash
      } : null
    }
  };
}

/**
 * Menyimpan snapshot resmi hasil pemilihan (Integritas Data)
 */
function createResultsSnapshot(adminId) {
  const settings = getElectionSettings();
  const totalVotersRow = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'voter'").get();
  const totalVotesRow = db.prepare('SELECT COUNT(*) as count FROM votes').get();

  const totalVoters = totalVotersRow ? totalVotersRow.count : 0;
  const totalVotes = totalVotesRow ? totalVotesRow.count : 0;
  const turnoutPercentage = totalVoters > 0 ? Number(((totalVotes / totalVoters) * 100).toFixed(2)) : 0;

  const tally = db.prepare(`
    SELECT c.candidate_number, c.name, COUNT(v.id) as count
    FROM candidates c
    LEFT JOIN votes v ON c.id = v.candidate_id
    GROUP BY c.id
    ORDER BY c.candidate_number ASC
  `).all();

  const breakdownJson = JSON.stringify(tally);
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  // Buat hash integritas kriptografis
  const integrityPayload = `${settings.id}|${totalVoters}|${totalVotes}|${breakdownJson}|${now}`;
  const integrityHash = crypto.createHash('sha256').update(integrityPayload).digest('hex');

  const stmt = db.prepare(`
    INSERT INTO results_snapshots (election_id, total_voters, total_votes, turnout_percentage, breakdown_json, integrity_hash, created_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const res = stmt.run(settings.id, totalVoters, totalVotes, turnoutPercentage, breakdownJson, integrityHash, now, adminId);

  logAudit('ELECTION_RESULTS_SNAPSHOT_CREATED', adminId, {
    snapshotId: Number(res.lastInsertRowid),
    integrityHash,
    totalVotes
  });

  return {
    snapshotId: Number(res.lastInsertRowid),
    integrityHash,
    totalVoters,
    totalVotes,
    turnoutPercentage,
    breakdown: tally,
    createdAt: now
  };
}

module.exports = {
  getElectionSettings,
  getCandidates,
  castVote,
  getResults,
  createResultsSnapshot
};
