const bcrypt = require('bcryptjs');
const db = require('./db');
const { initSchema } = require('./schema');
const { logAudit } = require('../services/auditService');

function seed() {
  console.log('[Seed] Memulai inisialisasi dan pengisian data simulasi E-PRESIDEN...');
  
  // Buat tabel jika belum ada
  initSchema();

  // Bersihkan tabel untuk reset bersih
  db.exec(`
    DELETE FROM fraud_events;
    DELETE FROM audit_logs;
    DELETE FROM results_snapshots;
    DELETE FROM votes;
    DELETE FROM candidates;
    DELETE FROM election_settings;
    DELETE FROM users;
  `);

  try {
    db.exec('DELETE FROM sqlite_sequence;');
  } catch (_) {}

  console.log('[Seed] Tabel lama dibersihkan.');

  // 1. Pengaturan Pemilihan
  const now = new Date();
  const startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const endTime = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

  const insertSettingStmt = db.prepare(`
    INSERT INTO election_settings (name, start_time, end_time, status)
    VALUES (?, ?, ?, 'ongoing')
  `);
  insertSettingStmt.run('Pemilihan Presiden & Wakil Presiden RI 2026 (Simulasi)', startTime, endTime);

  // 2. Kandidat
  const candidatesData = [
    {
      number: 1,
      name: 'Dr. Arya Wijaya & Ir. Siti Nurhaliza, M.T.',
      photo: '/img/paslon1.svg',
      vision: 'Mewujudkan Indonesia Emas yang Berdaulat, Berkeadilan Sosial, dan Berdaya Saing Digital Global.',
      mission: '1. Peningkatan mutu pendidikan riset & kecerdasan buatan nasional.\n2. Kemandirian pangan, energi, dan logistik maritim terpadu.\n3. Penguatan integritas aparatur negara dengan transparansi tata kelola digital.',
      programs: 'Kedaulatan Pangan Presisi, Akselerator Talenta Digital Nasional, Jaring Pengaman Sosial Terverifikasi.'
    },
    {
      number: 2,
      name: 'Prof. Budi Santoso, Ph.D. & Ratna Kusumawardhani, S.H., M.H.',
      photo: '/img/paslon2.svg',
      vision: 'Indonesia Berintegritas, Makmur, Hijau, dan Ramah Bagi Seluruh Generasi Masa Depan.',
      mission: '1. Transisi energi hijau dan perlindungan kelestarian ekosistem alam.\n2. Reformasi sistem hukum berkeadilan dan pemantauan korupsi tanpa kompromi.\n3. Akses kesehatan universal dan pemenuhan gizi merata bagi anak bangsa.',
      programs: 'Inisiatif Ekonomi Hijau 2030, Satu Desa Satu Fasilitas Kesehatan Modern, Penegakan Hukum & Peradilan Terbuka.'
    },
    {
      number: 3,
      name: 'Drs. Hendra Pratama, M.Sc. & dr. Dian Anggraini, Sp.A.',
      photo: '/img/paslon3.svg',
      vision: 'Nusantara Mandiri: Industrialisasi Kerakyatan, Kesejahteraan Pekerja, dan Persatuan Kebangsaan.',
      mission: '1. Hilirisasi komoditas lokal dan perlindungan industri usaha mikro-menengah.\n2. Transformasi pelayanan masyarakat berbasis kepastian waktu dan kemudahan izin.\n3. Penyediaan rumah layak bersubsidi dan perlindungan jaminan sosial tenaga kerja.',
      programs: 'Sentra Industri UMKM Daerah, Perumahan Ramah Generasi Muda, Beasiswa Riset Terapan Terpadu.'
    }
  ];

  const insertCandidateStmt = db.prepare(`
    INSERT INTO candidates (candidate_number, name, photo, vision, mission, programs)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const c of candidatesData) {
    insertCandidateStmt.run(c.number, c.name, c.photo, c.vision, c.mission, c.programs);
  }
  console.log('[Seed] Data 3 pasangan kandidat berhasil ditambahkan.');

  // 3. Pengguna (Users: Admin, Auditor, dan Pemilih)
  const salt = bcrypt.genSaltSync(10);
  const passwordHashAdmin = bcrypt.hashSync('admin123', salt);
  const passwordHashAuditor = bcrypt.hashSync('auditor123', salt);
  const passwordHashVoter = bcrypt.hashSync('voter123', salt);

  const insertUserStmt = db.prepare(`
    INSERT INTO users (voter_id, name, password_hash, role, has_voted)
    VALUES (?, ?, ?, ?, ?)
  `);

  // Admin & Auditor
  insertUserStmt.run('admin', 'Komisi Pemilihan (Administrator)', passwordHashAdmin, 'admin', 0);
  insertUserStmt.run('auditor', 'Badan Pengawas & Auditor Independen', passwordHashAuditor, 'auditor', 0);

  // Daftar Pemilih Simulasi
  const voters = [
    { id: 'pemilih01', name: 'Ahmad Fauzi (Belum Memilih)', hasVoted: 0 },
    { id: 'pemilih02', name: 'Dewi Lestari (Sudah Memilih)', hasVoted: 1 },
    { id: 'pemilih03', name: 'Rian Syahputra (Sudah Memilih)', hasVoted: 1 },
    { id: 'pemilih04', name: 'Bambang Sudarsono', hasVoted: 0 },
    { id: 'pemilih05', name: 'Siti Rahmawati', hasVoted: 0 },
    { id: 'pemilih06', name: 'Eko Prasetyo', hasVoted: 0 },
    { id: 'pemilih07', name: 'Nurul Hidayah', hasVoted: 0 },
    { id: 'pemilih08', name: 'Fajar Nugroho', hasVoted: 0 },
    { id: 'pemilih09', name: 'Intan Permatasari', hasVoted: 0 },
    { id: 'pemilih10', name: 'Agus Setiawan', hasVoted: 0 }
  ];

  for (const v of voters) {
    insertUserStmt.run(v.id, v.name, passwordHashVoter, 'voter', v.hasVoted);
  }
  console.log(`[Seed] Data ${voters.length} pemilih berhasil ditambahkan.`);

  // 4. Masukkan suara simulasi untuk pemilih02 dan pemilih03 (Kerahasiaan Suara: HANYA candidate_id dan token)
  const candRows = db.prepare('SELECT id, candidate_number FROM candidates ORDER BY candidate_number ASC').all();
  const cand1Id = candRows[0].id;
  const cand2Id = candRows[1].id;

  const insertVoteStmt = db.prepare('INSERT INTO votes (candidate_id, vote_token, created_at) VALUES (?, ?, ?)');
  const voteTime = new Date().toISOString().replace('T', ' ').substring(0, 19);
  insertVoteStmt.run(cand1Id, 'VOTE-SEED01-A98B2C', voteTime);
  insertVoteStmt.run(cand2Id, 'VOTE-SEED02-7D3F1E', voteTime);

  // 5. Inisialisasi Catatan Audit Log Awal
  const adminUser = db.prepare("SELECT id FROM users WHERE role = 'admin'").get();
  const pemilih02 = db.prepare("SELECT id FROM users WHERE voter_id = 'pemilih02'").get();
  const pemilih03 = db.prepare("SELECT id FROM users WHERE voter_id = 'pemilih03'").get();

  logAudit('SYSTEM_INITIALIZED', adminUser ? adminUser.id : null, { message: 'Database sistem E-PRESIDEN berhasil diinisialisasi.' });
  logAudit('ELECTION_STATUS_SET', adminUser ? adminUser.id : null, { status: 'ongoing', name: 'Pemilihan Presiden & Wakil Presiden RI 2026' });
  logAudit('VOTE_CAST', pemilih02 ? pemilih02.id : null, { ip: '127.0.0.1', status: 'SUKSES_TERCATAT', note: 'Simulasi suara awal pemilih 02' });
  logAudit('VOTE_CAST', pemilih03 ? pemilih03.id : null, { ip: '127.0.0.1', status: 'SUKSES_TERCATAT', note: 'Simulasi suara awal pemilih 03' });

  // 6. Inisialisasi Contoh Kejadian Fraud Awal untuk demonstrasi dashboard Anti-Fraud
  const insertFraudStmt = db.prepare(`
    INSERT INTO fraud_events (event_type, severity, description, status, created_at, reviewed_at, reviewed_by, review_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertFraudStmt.run(
    'SUSPICIOUS_LOGIN_ATTEMPTS',
    'review',
    'Terdeteksi 3 kali percobaan login dengan password salah untuk akun pemilih04 dari IP: 192.168.1.45.',
    'unreviewed',
    voteTime,
    null,
    null,
    null
  );

  insertFraudStmt.run(
    'DUPLICATE_VOTE_BLOCKED',
    'suspicious',
    'Percobaan pemungutan suara kedua dicegah secara otomatis oleh sistem untuk pemilih Dewi Lestari (ID: pemilih02).',
    'investigating',
    voteTime,
    voteTime,
    1,
    'Sedang dilakukan pencocokan log sesi pemilih untuk memastikan akun tidak disalahgunakan.'
  );

  console.log('[Seed] Inisialisasi data selesai!');
}

if (require.main === module) {
  seed();
}

module.exports = { seed };
