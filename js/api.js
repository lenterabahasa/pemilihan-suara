/**
 * E-PRESIDEN Client API & Session Adapter (Pure Frontend)
 * Seluruh pemanggilan rute ditangani secara instan oleh window.electionStore
 */

async function apiFetch(url, options = {}) {
  // Simulasi latensi mikro 40ms agar terasa interaktif
  await new Promise(r => setTimeout(r, 40));

  const store = window.electionStore;
  const path = url.split('?')[0];
  const queryParams = new URLSearchParams(url.includes('?') ? url.split('?')[1] : '');
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body ? JSON.parse(options.body) : {};

  // 1. AUTH
  if (path === '/api/auth/csrf-token') {
    return { csrfToken: 'frontend-local-csrf-token' };
  }

  if (path === '/api/auth/login' && method === 'POST') {
    try {
      const session = await store.login(body.voter_id, body.password);
      return { success: true, message: 'Login berhasil.', user: session };
    } catch (err) {
      const error = new Error(err.message);
      error.status = 401;
      throw error;
    }
  }

  if (path === '/api/auth/logout' && method === 'POST') {
    await store.logout();
    return { success: true, message: 'Berhasil keluar.' };
  }

  if (path === '/api/auth/me') {
    const user = store.getCurrentUser();
    return { authenticated: !!user, user };
  }

  // 2. VOTING
  if (path === '/api/vote/candidates') {
    return { success: true, candidates: store.data.candidates };
  }

  if (path === '/api/vote/status') {
    const user = store.getCurrentUser();
    return {
      success: true,
      election: store.data.election_settings,
      voter: user ? {
        hasVoted: user.has_voted === 1,
        voterId: user.voter_id,
        name: user.name,
        role: user.role
      } : null
    };
  }

  if (path === '/api/vote/cast' && method === 'POST') {
    try {
      return await store.castVote(body.candidateId);
    } catch (err) {
      const error = new Error(err.message);
      error.status = 400;
      throw error;
    }
  }

  if (path === '/api/vote/results') {
    const user = store.getCurrentUser();
    const role = user ? user.role : 'guest';
    return { success: true, ...store.getResults(role) };
  }

  // 3. ADMIN
  if (path === '/api/admin/voters' && method === 'GET') {
    const voters = store.data.users.filter(u => u.role === 'voter');
    return { success: true, voters };
  }

  if (path === '/api/admin/voters' && method === 'POST') {
    const existing = store.data.users.find(u => u.voter_id === String(body.voter_id).trim());
    if (existing) throw new Error('ID Pemilih sudah terdaftar.');

    const newId = store.data.users.length + 1;
    const newVoter = {
      id: newId,
      voter_id: String(body.voter_id).trim(),
      name: String(body.name).trim(),
      password: body.password,
      role: 'voter',
      has_voted: 0
    };
    store.data.users.push(newVoter);
    await store.logAudit('VOTER_REGISTERED', store.getCurrentUser()?.id, { new_voter_id: body.voter_id, name: body.name });
    store.save();
    return { success: true, voter: newVoter };
  }

  if (path.startsWith('/api/admin/voters/') && path.endsWith('/reset-password') && method === 'POST') {
    const parts = path.split('/');
    const id = Number(parts[4]);
    const voter = store.data.users.find(u => u.id === id);
    if (!voter) throw new Error('Pemilih tidak ditemukan.');
    voter.password = body.newPassword;
    await store.logAudit('VOTER_PASSWORD_RESET', store.getCurrentUser()?.id, { voter_id: voter.voter_id });
    store.save();
    return { success: true, message: 'Password berhasil direset.' };
  }

  if (path === '/api/admin/election' && method === 'PUT') {
    if (body.name) store.data.election_settings.name = body.name;
    if (body.status) store.data.election_settings.status = body.status;
    await store.logAudit('ELECTION_SETTING_CHANGED', store.getCurrentUser()?.id, body);
    store.save();
    return { success: true, message: 'Pengaturan berhasil diperbarui.' };
  }

  if (path === '/api/admin/election/snapshot' && method === 'POST') {
    const snapshot = await store.createSnapshot(store.getCurrentUser()?.id || 1);
    return { success: true, snapshot };
  }

  if (path === '/api/admin/fraud-events' && method === 'GET') {
    const severity = queryParams.get('severity') || 'all';
    const status = queryParams.get('status') || 'all';
    let list = store.data.fraud_events;
    if (severity !== 'all') list = list.filter(e => e.severity === severity);
    if (status !== 'all') list = list.filter(e => e.status === status);
    return { success: true, events: list };
  }

  if (path.startsWith('/api/admin/fraud-events/') && method === 'PUT') {
    const id = Number(path.split('/')[4]);
    const event = store.data.fraud_events.find(e => e.id === id);
    if (!event) throw new Error('Event fraud tidak ditemukan.');
    event.status = body.status;
    event.reviewed_at = new Date().toISOString().replace('T', ' ').substring(0, 19);
    event.reviewed_by = store.getCurrentUser()?.id || 1;
    event.review_notes = body.notes || '';
    await store.logAudit('FRAUD_EVENT_REVIEWED', store.getCurrentUser()?.id, { fraud_id: id, status: body.status });
    store.save();
    return { success: true, event };
  }

  // 4. AUDIT
  if (path === '/api/audit/logs') {
    return { success: true, logs: [...store.data.audit_logs].reverse() };
  }

  if (path === '/api/audit/verify-integrity' && method === 'POST') {
    const result = await store.verifyAuditLogIntegrity();
    return { success: true, verification: result };
  }

  if (path === '/api/audit/snapshots') {
    return { success: true, snapshots: [...store.data.results_snapshots].reverse() };
  }

  return { success: true };
}

async function getCurrentUser() {
  if (!window.electionStore) return null;
  return window.electionStore.getCurrentUser();
}

async function handleLogout() {
  if (window.electionStore) {
    await window.electionStore.logout();
  }
  window.location.href = 'login.html';
}

function updateNavAuthUI(user) {
  const navContainer = document.getElementById('navAuthContainer');
  if (!navContainer) return;

  if (user) {
    let roleBadge = '';
    let rolePageLink = '';

    if (user.role === 'admin') {
      roleBadge = '<span class="badge badge-info">Admin</span>';
      rolePageLink = '<a href="admin.html" class="nav-link">Panel Admin</a>';
    } else if (user.role === 'auditor') {
      roleBadge = '<span class="badge badge-warning">Auditor</span>';
      rolePageLink = '<a href="auditor.html" class="nav-link">Portal Auditor</a>';
    } else {
      roleBadge = user.has_voted ? '<span class="badge badge-success">Sudah Memilih</span>' : '<span class="badge badge-neutral">Belum Memilih</span>';
      rolePageLink = '<a href="bilik-suara.html" class="nav-link">Bilik Suara</a>';
    }

    navContainer.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
        ${rolePageLink}
        <div class="user-badge">
          <span>👤 ${escapeHtml(user.name)}</span>
          ${roleBadge}
        </div>
        <button onclick="handleLogout()" class="btn btn-secondary btn-sm">Keluar</button>
      </div>
    `;
  } else {
    navContainer.innerHTML = `
      <a href="login.html" class="btn btn-primary btn-sm">Masuk / Login</a>
    `;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showAlert(containerId, message, type = 'danger') {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `
    <div class="alert alert-${type}">
      <div>${escapeHtml(message)}</div>
    </div>
  `;
}

function clearAlert(containerId) {
  const container = document.getElementById(containerId);
  if (container) container.innerHTML = '';
}

// Fungsi reset database simulasi ke keadaan awal
async function resetSimulation() {
  if (confirm('Apakah Anda yakin ingin mereset seluruh data pemilihan simulasi ke kondisi awal?')) {
    if (window.electionStore) {
      await window.electionStore.reset();
      alert('Data simulasi berhasil direset ke kondisi awal.');
      window.location.reload();
    }
  }
}
