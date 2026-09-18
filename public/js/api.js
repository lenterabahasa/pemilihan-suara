/**
 * E-PRESIDEN Client API & Session Helper
 */

let cachedCsrfToken = null;

async function getCsrfToken() {
  if (cachedCsrfToken) return cachedCsrfToken;
  try {
    const res = await fetch('/api/auth/csrf-token');
    const data = await res.json();
    cachedCsrfToken = data.csrfToken;
    return cachedCsrfToken;
  } catch (err) {
    console.error('Gagal mengambil token CSRF:', err);
    return null;
  }
}

async function apiFetch(url, options = {}) {
  const headers = options.headers ? { ...options.headers } : {};

  if (!headers['Content-Type'] && !(options.body instanceof FormData) && options.method && options.method !== 'GET') {
    headers['Content-Type'] = 'application/json';
  }

  // Sertakan token CSRF untuk metode pengubah data
  if (options.method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method.toUpperCase())) {
    const token = await getCsrfToken();
    if (token) {
      headers['x-csrf-token'] = token;
    }
  }

  const res = await fetch(url, {
    ...options,
    headers
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}: Terjadi kesalahan.`);
  }

  // Jika respons menyertakan token CSRF baru, simpan
  if (data.csrfToken) {
    cachedCsrfToken = data.csrfToken;
  }

  return data;
}

async function getCurrentUser() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.csrfToken) cachedCsrfToken = data.csrfToken;
    return data.authenticated ? data.user : null;
  } catch (err) {
    return null;
  }
}

async function handleLogout() {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch (e) {
  } finally {
    window.location.href = '/login.html';
  }
}

function updateNavAuthUI(user) {
  const navContainer = document.getElementById('navAuthContainer');
  if (!navContainer) return;

  if (user) {
    let roleBadge = '';
    let rolePageLink = '';

    if (user.role === 'admin') {
      roleBadge = '<span class="badge badge-info">Admin</span>';
      rolePageLink = '<a href="/admin.html" class="nav-link">Panel Admin</a>';
    } else if (user.role === 'auditor') {
      roleBadge = '<span class="badge badge-warning">Auditor</span>';
      rolePageLink = '<a href="/auditor.html" class="nav-link">Portal Auditor</a>';
    } else {
      roleBadge = user.has_voted ? '<span class="badge badge-success">Sudah Memilih</span>' : '<span class="badge badge-neutral">Belum Memilih</span>';
      rolePageLink = '<a href="/bilik-suara.html" class="nav-link">Bilik Suara</a>';
    }

    navContainer.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
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
      <a href="/login.html" class="btn btn-primary btn-sm">Masuk / Login</a>
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
