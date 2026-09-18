/**
 * Test HTTP Server & Endpoints
 */
const app = require('../src/server');

const server = app.listen(3001, async () => {
  console.log('[HTTP Test] Server uji coba berjalan pada port 3001...');
  try {
    // 1. Test GET /
    const homeRes = await fetch('http://localhost:3001/');
    if (homeRes.status !== 200) throw new Error('GET / gagal: ' + homeRes.status);
    console.log('✓ GET / : 200 OK');

    // 2. Test GET /api/vote/candidates
    const candRes = await fetch('http://localhost:3001/api/vote/candidates');
    const candData = await candRes.json();
    if (!candData.success || candData.candidates.length !== 3) throw new Error('Candidates data invalid');
    console.log(`✓ GET /api/vote/candidates : OK (${candData.candidates.length} kandidat)`);

    // 3. Test GET /api/vote/status
    const statRes = await fetch('http://localhost:3001/api/vote/status');
    const statData = await statRes.json();
    if (!statData.success || !statData.election) throw new Error('Election status invalid');
    console.log(`✓ GET /api/vote/status : OK (Status: ${statData.election.status})`);

    // 4. Test Login Pemilih
    const loginRes = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voter_id: 'pemilih01', password: 'voter123' })
    });
    const loginData = await loginRes.json();
    if (!loginData.success || loginData.user.role !== 'voter') throw new Error('Login failed: ' + JSON.stringify(loginData));
    console.log(`✓ POST /api/auth/login : OK (User: ${loginData.user.name})`);

    console.log('\nSELURUH UJI HTTP ENDPOINT BERHASIL!');
    server.close(() => process.exit(0));
  } catch (err) {
    console.error('HTTP Test Error:', err);
    server.close(() => process.exit(1));
  }
});
