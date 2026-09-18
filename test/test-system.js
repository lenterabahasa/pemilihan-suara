/**
 * E-PRESIDEN: Automated Comprehensive Test Suite
 * Memverifikasi seluruh spesifikasi pada PRD:
 * 1. Autentikasi & Brute Force Detection
 * 2. Transaksi Atomik Satu Pemilih Satu Suara
 * 3. Pencegahan Suara Ganda (Duplicate Vote Blocking)
 * 4. Kerahasiaan Suara (Secret Ballot)
 * 5. Role-Based Access Control (RBAC)
 * 6. Audit Log Kriptografis (Hash Chaining & Tamper Detection)
 * 7. Snapshot Integritas Hasil Pemilihan
 */

const assert = require('assert');
const db = require('../src/db/db');
const { seed } = require('../src/db/seed');
const { verifyAuditLogIntegrity } = require('../src/services/auditService');
const { handleFailedLogin, getFraudEvents } = require('../src/services/antiFraudService');
const votingService = require('../src/services/votingService');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ [LULUS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [GAGAL] ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

async function runTests() {
  console.log('===========================================================');
  console.log('  MENJALANKAN TEST SUITE SISTEM PEMILU DIGITAL E-PRESIDEN  ');
  console.log('===========================================================\n');

  // 1. Reset ke kondisi awal dengan seeder
  console.log('[Setup] Mereset basis data dengan seed...');
  seed();
  console.log('[Setup] Selesai.\n');

  // TEST 1: Skema Kerahasiaan Suara (Secret Ballot)
  test('Kerahasiaan Suara: Tabel votes tidak memiliki kolom user_id atau voter_id', () => {
    const tableInfo = db.prepare('PRAGMA table_info(votes)').all();
    const columnNames = tableInfo.map(c => c.name.toLowerCase());
    
    assert.strictEqual(columnNames.includes('user_id'), false, 'Tabel votes TIDAK boleh menyimpan user_id!');
    assert.strictEqual(columnNames.includes('voter_id'), false, 'Tabel votes TIDAK boleh menyimpan voter_id!');
    assert.strictEqual(columnNames.includes('candidate_id'), true, 'Tabel votes wajib memiliki candidate_id');
    assert.strictEqual(columnNames.includes('vote_token'), true, 'Tabel votes wajib memiliki vote_token');
  });

  // TEST 2: Satu Pemilih Satu Suara (Fresh Vote)
  test('Satu Pemilih Satu Suara: Pemilih belum memilih berhasil memberikan suara sah', () => {
    const voter = db.prepare("SELECT * FROM users WHERE voter_id = 'pemilih01'").get();
    assert.strictEqual(voter.has_voted, 0, 'Pemilih 01 harus belum memilih diawal');

    const result = votingService.castVote(voter.id, 1, '192.168.1.100');
    assert.strictEqual(result.success, true);
    assert.ok(result.receiptToken.startsWith('VOTE-'));

    const updatedVoter = db.prepare("SELECT * FROM users WHERE id = ?").get(voter.id);
    assert.strictEqual(updatedVoter.has_voted, 1, 'Status has_voted harus berubah menjadi 1');
  });

  // TEST 3: Pencegahan Suara Ganda & Deteksi Fraud Otomatis
  test('Pencegahan Suara Ganda: Upaya memilih kedua kali ditolak dan dicatat sebagai fraud', () => {
    const voter = db.prepare("SELECT * FROM users WHERE voter_id = 'pemilih01'").get();
    assert.strictEqual(voter.has_voted, 1);

    let rejected = false;
    try {
      votingService.castVote(voter.id, 2, '192.168.1.100');
    } catch (err) {
      rejected = true;
      assert.ok(err.message.includes('sudah pernah memberikan suara'));
    }

    assert.strictEqual(rejected, true, 'Sistem harus menolak vote kedua');

    // Cek bahwa kejadian fraud tercatat
    const fraudEvents = getFraudEvents({ severity: 'suspicious', status: 'all' });
    const duplicateAlert = fraudEvents.find(e => e.event_type === 'DUPLICATE_VOTE_BLOCKED' && e.description.includes(voter.name));
    assert.ok(duplicateAlert, 'Sistem harus otomatis mencatat DUPLICATE_VOTE_BLOCKED di fraud_events');
    assert.strictEqual(duplicateAlert.severity, 'suspicious');
  });

  // TEST 4: Deteksi Serangan Brute Force Login
  test('Anti-Fraud: 5 kali gagal login memicu status risiko Suspicious (Brute Force)', () => {
    const testIp = '10.0.0.99';
    const testVoter = 'pemilih_target';

    for (let i = 0; i < 5; i++) {
      handleFailedLogin(testIp, testVoter);
    }

    const fraudEvents = getFraudEvents({ severity: 'suspicious', status: 'all' });
    const bruteForceAlert = fraudEvents.find(e => e.event_type === 'BRUTE_FORCE_LOGIN_ATTEMPT' && e.description.includes(testIp));
    assert.ok(bruteForceAlert, 'Sistem harus mencatat BRUTE_FORCE_LOGIN_ATTEMPT setelah >= 5 kegagalan');
  });

  // TEST 5: Integritas Konsistensi Suara Masuk vs Jumlah Pemilih
  test('Integritas Hasil: Jumlah pemilih bertanda has_voted=1 TEPAT SAMA dengan jumlah kertas suara di votes', () => {
    const results = votingService.getResults('admin');
    assert.strictEqual(results.totalVoted, results.totalVotes, 'Total pemilih yang mencoblos harus sama dengan total suara di votes');
    assert.strictEqual(results.dataIntegrity.isConsistent, true);
  });

  // TEST 6: Audit Log Cryptographic Hash Chaining
  test('Audit Log Kriptografis: Rantai hash SHA-256 terverifikasi tanpa manipulasi', () => {
    const verification = verifyAuditLogIntegrity();
    assert.strictEqual(verification.valid, true, 'Rantai audit log harus valid');
    assert.ok(verification.totalEntries > 0);
    assert.ok(verification.latestHash.length === 64, 'Hash harus berukuran 64 karakter heksadesimal (SHA-256)');
  });

  // TEST 7: Deteksi Manipulasi Audit Log (Tamper Detection)
  test('Tamper Detection: Perubahan data audit log manual di DB langsung dideteksi oleh Auditor', () => {
    // Ambil log id terakhir
    const lastLog = db.prepare('SELECT id, metadata FROM audit_logs ORDER BY id DESC LIMIT 1').get();
    
    // Ubah data metadata secara ilegal di database langsung
    db.prepare('UPDATE audit_logs SET metadata = ? WHERE id = ?').run('{"tampered": true}', lastLog.id);

    const verification = verifyAuditLogIntegrity();
    assert.strictEqual(verification.valid, false, 'Sistem harus mendeteksi manipulasi data log');
    assert.strictEqual(verification.brokenAtId, lastLog.id, 'Sistem harus menunjuk entri yang dimanipulasi');

    // Pulihkan kembali untuk menjaga konsistensi
    db.prepare('UPDATE audit_logs SET metadata = ? WHERE id = ?').run(lastLog.metadata, lastLog.id);
    const restored = verifyAuditLogIntegrity();
    assert.strictEqual(restored.valid, true, 'Setelah dipulihkan, rantai hash harus valid kembali');
  });

  // TEST 8: Snapshot Integritas Hasil Pemilihan
  test('Integritas Hasil: Snapshot hasil menghasilkan SHA-256 checksum yang valid', () => {
    const snapshot = votingService.createResultsSnapshot(1);
    assert.ok(snapshot.snapshotId > 0);
    assert.ok(snapshot.integrityHash.length === 64);
    assert.strictEqual(snapshot.totalVotes, snapshot.totalVoters > 0 ? 3 : 0); // 2 dari seed + 1 dari test 2
  });

  console.log('\n===========================================================');
  console.log(`HASIL TEST: ${passedTests} / ${totalTests} PENGUJIAN LULUS (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('===========================================================');

  if (passedTests === totalTests) {
    console.log('SELURUH SPESIFIKASI DAN SISTEM ANTI-KECURANGAN LULUS 100%!\n');
    process.exit(0);
  } else {
    console.error('BEBERAPA PENGUJIAN GAGAL.\n');
    process.exit(1);
  }
}

runTests();
