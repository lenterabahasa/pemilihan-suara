/**
 * E-PRESIDEN: Pure Client-Side Storage & Security Engine
 * Seluruh data disimpan dan diproses secara lokal di browser menggunakan localStorage
 * Mengimplementasikan:
 * - Kerahasiaan Suara (Votes table tanpa user_id)
 * - Satu Pemilih Satu Suara (Atomic state lock & duplicate vote blocking)
 * - Mesin Anti-Fraud (Deteksi Brute Force & Anomali)
 * - Audit Log Kriptografis Berantai (Hash Chaining SHA-256)
 */

const STORAGE_KEY = 'epresiden_state_v1.0';
const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

// SHA-256 Kriptografis Murni (Bekerja di Web Crypto API & Fallback Offline)
async function sha256(str) {
  if (window.crypto && window.crypto.subtle) {
    try {
      const msgBuffer = new TextEncoder().encode(str);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (_) {}
  }
  // Fallback JS Implementation jika dijalankan pada insecure context
  return jsSha256(str);
}

function jsSha256(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let lengthProperty = 'length';
  let i, j;
  let result = '';
  const words = [];
  const asciiBitLength = ascii[lengthProperty] * 8;
  let hash = [];
  const k = [];
  let primeCounter = 0;
  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  ascii += '\x80';
  while ((ascii[lengthProperty] % 64) - 56) ascii += '\x00';
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return;
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength;
  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);
    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];
      const a = hash[0], e = hash[4];
      const temp1 = hash[7] + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) + ((e & hash[5]) ^ (~e & hash[6])) + k[i] + (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) | 0);
      const temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }
    for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }
  for (i = 0; i < 8; i++) {
    for (i2 = 3; i2 >= 0; i2--) {
      const b = (hash[i] >> (8 * i2)) & 255;
      result += ((b < 16) ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

// Data Awal Seed
function getInitialSeed() {
  const now = new Date();
  const timeStr = now.toISOString().replace('T', ' ').substring(0, 19);

  return {
    election_settings: {
      id: 1,
      name: 'Pemilihan Presiden & Wakil Presiden RI 2026 (Simulasi)',
      start_time: new Date(now.getTime() - 24 * 3600000).toISOString(),
      end_time: new Date(now.getTime() + 48 * 3600000).toISOString(),
      status: 'ongoing'
    },
    candidates: [
      {
        id: 1,
        candidate_number: 1,
        name: 'Dr. Arya Wijaya & Ir. Siti Nurhaliza, M.T.',
        photo: 'img/paslon1.svg',
        vision: 'Mewujudkan Indonesia Emas yang Berdaulat, Berkeadilan Sosial, dan Berdaya Saing Digital Global.',
        mission: '1. Peningkatan mutu pendidikan riset & kecerdasan buatan nasional.\n2. Kemandirian pangan, energi, dan logistik maritim terpadu.\n3. Penguatan integritas aparatur negara dengan transparansi tata kelola digital.',
        programs: 'Kedaulatan Pangan Presisi, Akselerator Talenta Digital Nasional, Jaring Pengaman Sosial Terverifikasi.'
      },
      {
        id: 2,
        candidate_number: 2,
        name: 'Prof. Budi Santoso, Ph.D. & Ratna Kusumawardhani, S.H., M.H.',
        photo: 'img/paslon2.svg',
        vision: 'Indonesia Berintegritas, Makmur, Hijau, dan Ramah Bagi Seluruh Generasi Masa Depan.',
        mission: '1. Transisi energi hijau dan perlindungan kelestarian ekosistem alam.\n2. Reformasi sistem hukum berkeadilan dan pemantauan korupsi tanpa kompromi.\n3. Akses kesehatan universal dan pemenuhan gizi merata bagi anak bangsa.',
        programs: 'Inisiatif Ekonomi Hijau 2030, Satu Desa Satu Fasilitas Kesehatan Modern, Penegakan Hukum & Peradilan Terbuka.'
      },
      {
        id: 3,
        candidate_number: 3,
        name: 'Drs. Hendra Pratama, M.Sc. & dr. Dian Anggraini, Sp.A.',
        photo: 'img/paslon3.svg',
        vision: 'Nusantara Mandiri: Industrialisasi Kerakyatan, Kesejahteraan Pekerja, dan Persatuan Kebangsaan.',
        mission: '1. Hilirisasi komoditas lokal dan perlindungan industri usaha mikro-menengah.\n2. Transformasi pelayanan masyarakat berbasis kepastian waktu dan kemudahan izin.\n3. Penyediaan rumah layak bersubsidi dan perlindungan jaminan sosial tenaga kerja.',
        programs: 'Sentra Industri UMKM Daerah, Perumahan Ramah Generasi Muda, Beasiswa Riset Terapan Terpadu.'
      }
    ],
    users: [
      { id: 1, voter_id: 'admin', name: 'Komisi Pemilihan (Administrator)', password: 'admin123', role: 'admin', has_voted: 0 },
      { id: 2, voter_id: 'auditor', name: 'Badan Pengawas & Auditor Independen', password: 'auditor123', role: 'auditor', has_voted: 0 },
      { id: 3, voter_id: 'pemilih01', name: 'Ahmad Fauzi (Belum Memilih)', password: 'voter123', role: 'voter', has_voted: 0 },
      { id: 4, voter_id: 'pemilih02', name: 'Dewi Lestari (Sudah Memilih)', password: 'voter123', role: 'voter', has_voted: 1 },
      { id: 5, voter_id: 'pemilih03', name: 'Rian Syahputra (Sudah Memilih)', password: 'voter123', role: 'voter', has_voted: 1 },
      { id: 6, voter_id: 'pemilih04', name: 'Bambang Sudarsono', password: 'voter123', role: 'voter', has_voted: 0 },
      { id: 7, voter_id: 'pemilih05', name: 'Siti Rahmawati', password: 'voter123', role: 'voter', has_voted: 0 },
      { id: 8, voter_id: 'pemilih06', name: 'Eko Prasetyo', password: 'voter123', role: 'voter', has_voted: 0 },
      { id: 9, voter_id: 'pemilih07', name: 'Nurul Hidayah', password: 'voter123', role: 'voter', has_voted: 0 },
      { id: 10, voter_id: 'pemilih08', name: 'Fajar Nugroho', password: 'voter123', role: 'voter', has_voted: 0 },
      { id: 11, voter_id: 'pemilih09', name: 'Intan Permatasari', password: 'voter123', role: 'voter', has_voted: 0 },
      { id: 12, voter_id: 'pemilih10', name: 'Agus Setiawan', password: 'voter123', role: 'voter', has_voted: 0 }
    ],
    // Kerahasiaan Suara: Tabel votes TIDAK memiliki kolom user_id!
    votes: [
      { id: 1, candidate_id: 1, vote_token: 'VOTE-SEED01-A98B2C', created_at: timeStr },
      { id: 2, candidate_id: 2, vote_token: 'VOTE-SEED02-7D3F1E', created_at: timeStr }
    ],
    audit_logs: [],
    fraud_events: [
      {
        id: 1,
        event_type: 'SUSPICIOUS_LOGIN_ATTEMPTS',
        severity: 'review',
        description: 'Terdeteksi 3 kali percobaan login dengan password salah untuk akun pemilih04 dari IP: 192.168.1.45.',
        status: 'unreviewed',
        created_at: timeStr,
        reviewed_at: null,
        reviewed_by: null,
        review_notes: null
      },
      {
        id: 2,
        event_type: 'DUPLICATE_VOTE_BLOCKED',
        severity: 'suspicious',
        description: 'Percobaan pemungutan suara kedua dicegah secara otomatis oleh sistem untuk pemilih Dewi Lestari (ID: pemilih02).',
        status: 'investigating',
        created_at: timeStr,
        reviewed_at: timeStr,
        reviewed_by: 1,
        review_notes: 'Sedang dilakukan pencocokan log sesi pemilih untuk memastikan akun tidak disalahgunakan.'
      }
    ],
    results_snapshots: [],
    session: null
  };
}

class ElectionStore {
  constructor() {
    this.data = this.load();
    if (!this.data || !this.data.users) {
      this.reset();
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.error('Storage save error:', e);
    }
  }

  async reset() {
    this.data = getInitialSeed();
    // Buat initial audit log berantai
    await this.logAudit('SYSTEM_INITIALIZED', 1, { message: 'Database sistem E-PRESIDEN (Frontend Store) berhasil diinisialisasi.' });
    await this.logAudit('ELECTION_STATUS_SET', 1, { status: 'ongoing', name: 'Pemilihan Presiden & Wakil Presiden RI 2026' });
    await this.logAudit('VOTE_CAST', 4, { ip: '127.0.0.1', status: 'SUKSES_TERCATAT', note: 'Simulasi suara awal pemilih 02' });
    await this.logAudit('VOTE_CAST', 5, { ip: '127.0.0.1', status: 'SUKSES_TERCATAT', note: 'Simulasi suara awal pemilih 03' });
    this.save();
  }

  // --- AUDIT LOG & CRYPTOGRAPHIC HASH CHAIN ---
  async logAudit(eventType, userId = null, metadata = {}) {
    const metadataStr = typeof metadata === 'string' ? metadata : JSON.stringify(metadata);
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const logs = this.data.audit_logs;
    const lastLog = logs.length > 0 ? logs[logs.length - 1] : null;
    const previousHash = lastLog && lastLog.log_hash ? lastLog.log_hash : GENESIS_HASH;

    const newId = logs.length > 0 ? (logs[logs.length - 1].id + 1) : 1;
    const payload = `${previousHash}|${eventType}|${userId ?? 'SYSTEM'}|${metadataStr}|${now}`;
    const logHash = await sha256(payload);

    const entry = {
      id: newId,
      event_type: eventType,
      user_id: userId,
      metadata: metadataStr,
      previous_hash: previousHash,
      log_hash: logHash,
      created_at: now
    };

    logs.push(entry);
    this.save();
    return entry;
  }

  async verifyAuditLogIntegrity() {
    const logs = this.data.audit_logs;
    if (logs.length === 0) {
      return { valid: true, totalEntries: 0, message: 'Belum ada catatan audit log.' };
    }

    let expectedPrevHash = GENESIS_HASH;
    for (let i = 0; i < logs.length; i++) {
      const row = logs[i];
      if (row.previous_hash !== expectedPrevHash) {
        return {
          valid: false,
          totalEntries: logs.length,
          brokenAtId: row.id,
          reason: `Ketidaksesuaian rantai hash pada entri #${row.id}. Previous hash tidak cocok.`
        };
      }

      const payload = `${row.previous_hash}|${row.event_type}|${row.user_id ?? 'SYSTEM'}|${row.metadata || '{}'}|${row.created_at}`;
      const calculatedHash = await sha256(payload);

      if (calculatedHash !== row.log_hash) {
        return {
          valid: false,
          totalEntries: logs.length,
          brokenAtId: row.id,
          reason: `Manipulasi terdeteksi pada entri #${row.id}. Hash data tidak sesuai dengan konten tercatat.`
        };
      }
      expectedPrevHash = row.log_hash;
    }

    return {
      valid: true,
      totalEntries: logs.length,
      latestHash: expectedPrevHash,
      message: 'Seluruh rantai audit log valid dan terverifikasi secara kriptografis.'
    };
  }

  // --- ANTI-FRAUD ENGINE ---
  async recordFraudEvent({ eventType, severity, description, userId = null, metadata = {} }) {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const events = this.data.fraud_events;
    const newId = events.length > 0 ? (events[events.length - 1].id + 1) : 1;

    const event = {
      id: newId,
      event_type: eventType,
      severity,
      description,
      status: 'unreviewed',
      created_at: now,
      reviewed_at: null,
      reviewed_by: null,
      review_notes: null
    };

    events.unshift(event); // newest first
    await this.logAudit('FRAUD_EVENT_RECORDED', userId, {
      fraud_event_id: newId,
      eventType,
      severity,
      description,
      ...metadata
    });

    this.save();
    return event;
  }

  async handleFailedLogin(voterId) {
    const key = `failed_logins_${voterId || 'guest'}`;
    let attempts = parseInt(sessionStorage.getItem(key) || '0', 10) + 1;
    sessionStorage.setItem(key, attempts);

    if (attempts >= 5) {
      await this.recordFraudEvent({
        eventType: 'BRUTE_FORCE_LOGIN_ATTEMPT',
        severity: 'suspicious',
        description: `Percobaan login gagal berulang kali (${attempts}x) terdeteksi untuk akun ${voterId || 'anonim'}. Indikasi Brute Force.`,
        metadata: { voterId, attempts }
      });
    } else if (attempts >= 3) {
      await this.recordFraudEvent({
        eventType: 'SUSPICIOUS_LOGIN_ATTEMPTS',
        severity: 'review',
        description: `Terdeteksi 3 kali kegagalan login berturut-turut untuk akun ${voterId || 'anonim'}. Perlu ditinjau.`,
        metadata: { voterId, attempts }
      });
    }
  }

  // --- AUTHENTICATION ---
  async login(voterId, password) {
    const user = this.data.users.find(u => u.voter_id === String(voterId).trim());

    if (!user || user.password !== password) {
      await this.handleFailedLogin(voterId);
      await this.logAudit('LOGIN_FAILED', user ? user.id : null, { voter_id: voterId, reason: 'Kredensial salah' });
      throw new Error('ID Pemilih atau password yang Anda masukkan salah.');
    }

    // Reset failed counter
    sessionStorage.removeItem(`failed_logins_${voterId}`);

    this.data.session = {
      id: user.id,
      voter_id: user.voter_id,
      name: user.name,
      role: user.role,
      has_voted: user.has_voted
    };
    this.save();

    const eventName = user.role === 'admin' ? 'ADMIN_LOGIN' : (user.role === 'auditor' ? 'AUDITOR_LOGIN' : 'LOGIN_SUCCESS');
    await this.logAudit(eventName, user.id, { voter_id: user.voter_id, role: user.role });

    return this.data.session;
  }

  async logout() {
    if (this.data.session) {
      await this.logAudit('LOGOUT', this.data.session.id, {});
      this.data.session = null;
      this.save();
    }
  }

  getCurrentUser() {
    if (!this.data.session) return null;
    const user = this.data.users.find(u => u.id === this.data.session.id);
    if (!user) {
      this.data.session = null;
      this.save();
      return null;
    }
    this.data.session.has_voted = user.has_voted;
    this.data.session.name = user.name;
    this.data.session.role = user.role;
    return this.data.session;
  }

  // --- VOTING (TRANSAKSI ATOMIK & KERAHASIAAN SUARA) ---
  async castVote(candidateId) {
    const session = this.getCurrentUser();
    if (!session) throw new Error('Silakan login terlebih dahulu.');
    if (session.role !== 'voter') throw new Error('Hanya pemilih yang berhak memberikan suara.');

    const settings = this.data.election_settings;
    if (settings.status !== 'ongoing') {
      throw new Error(`Pemilihan saat ini berstatus '${settings.status}'. Pemungutan suara hanya dapat dilakukan saat berstatus 'ongoing'.`);
    }

    const user = this.data.users.find(u => u.id === session.id);
    if (!user) throw new Error('Data pemilih tidak ditemukan.');

    // PENCEGAHAN SUARA GANDA
    if (user.has_voted === 1) {
      await this.recordFraudEvent({
        eventType: 'DUPLICATE_VOTE_BLOCKED',
        severity: 'suspicious',
        userId: user.id,
        description: `Percobaan pemungutan suara kedua dicegah untuk pemilih: ${user.name} (${user.voter_id}). Hak pilih sudah digunakan sebelumnya.`
      });
      await this.logAudit('DUPLICATE_VOTE_BLOCKED', user.id, { voter_id: user.voter_id });
      throw new Error('Peringatan: Anda sudah pernah memberikan suara! Setiap pemilih hanya berhak atas satu suara.');
    }

    const candidate = this.data.candidates.find(c => c.id === Number(candidateId));
    if (!candidate) throw new Error('Kandidat tidak valid.');

    // KERAHASIAAN SUARA: Simpan ke votes TANPA user_id!
    const randomBytes = Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    const voteToken = 'VOTE-' + randomBytes;
    const voteTime = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const newVoteId = this.data.votes.length > 0 ? (this.data.votes[this.data.votes.length - 1].id + 1) : 1;
    this.data.votes.push({
      id: newVoteId,
      candidate_id: Number(candidateId),
      vote_token: voteToken,
      created_at: voteTime
    });

    // Tandai pemilih telah memilih
    user.has_voted = 1;
    this.data.session.has_voted = 1;

    // Catat audit log (TIDAK menyertakan candidate_id demi kerahasiaan suara)
    await this.logAudit('VOTE_CAST', user.id, {
      voter_id: user.voter_id,
      status: 'SUKSES_TERCATAT',
      note: 'Suara tersimpan secara anonim'
    });

    this.save();

    return {
      success: true,
      message: 'Suara Anda berhasil tercatat secara sah dan rahasia.',
      receiptToken: voteToken,
      timestamp: voteTime
    };
  }

  // --- HASIL & STATISTIK ---
  getResults(userRole = 'voter') {
    const settings = this.data.election_settings;
    const isPrivileged = userRole === 'admin' || userRole === 'auditor';

    const voters = this.data.users.filter(u => u.role === 'voter');
    const totalVoters = voters.length;
    const totalVoted = voters.filter(u => u.has_voted === 1).length;
    const totalVotes = this.data.votes.length;
    const totalNonVoters = Math.max(0, totalVoters - totalVoted);
    const turnoutPercentage = totalVoters > 0 ? Number(((totalVoted / totalVoters) * 100).toFixed(2)) : 0;

    if (!isPrivileged && settings.status !== 'published') {
      return {
        published: false,
        status: settings.status,
        electionName: settings.name,
        message: 'Hasil pemilihan resmi akan dipublikasikan setelah seluruh proses pemungutan suara dan rekapitulasi selesai.',
        participation: { totalVoters, totalVoted, turnoutPercentage }
      };
    }

    const candidateResults = this.data.candidates.map(c => {
      const votes = this.data.votes.filter(v => v.candidate_id === c.id).length;
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

    const latestSnapshot = this.data.results_snapshots.length > 0 
      ? this.data.results_snapshots[this.data.results_snapshots.length - 1] 
      : null;

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
        latestSnapshot
      }
    };
  }

  async createSnapshot(adminId) {
    const settings = this.data.election_settings;
    const voters = this.data.users.filter(u => u.role === 'voter');
    const totalVoters = voters.length;
    const totalVotes = this.data.votes.length;
    const turnoutPercentage = totalVoters > 0 ? Number(((totalVotes / totalVoters) * 100).toFixed(2)) : 0;

    const tally = this.data.candidates.map(c => ({
      candidate_number: c.candidate_number,
      name: c.name,
      count: this.data.votes.filter(v => v.candidate_id === c.id).length
    }));

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const breakdownJson = JSON.stringify(tally);
    const integrityPayload = `${settings.id}|${totalVoters}|${totalVotes}|${breakdownJson}|${now}`;
    const integrityHash = await sha256(integrityPayload);

    const newId = this.data.results_snapshots.length + 1;
    const snapshot = {
      id: newId,
      election_id: settings.id,
      total_voters: totalVoters,
      total_votes: totalVotes,
      turnout_percentage: turnoutPercentage,
      breakdown_json: breakdownJson,
      integrity_hash: integrityHash,
      created_at: now,
      created_by: adminId,
      created_by_name: 'Admin'
    };

    this.data.results_snapshots.push(snapshot);
    await this.logAudit('ELECTION_RESULTS_SNAPSHOT_CREATED', adminId, {
      snapshotId: newId,
      integrityHash,
      totalVotes
    });

    this.save();
    return snapshot;
  }
}

// Instance Singleton
window.electionStore = new ElectionStore();
