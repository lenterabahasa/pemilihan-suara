const crypto = require('crypto');

function csrfMiddleware(req, res, next) {
  // Pastikan sesi ada
  if (req.session) {
    if (!req.session.csrfToken) {
      req.session.csrfToken = crypto.randomBytes(24).toString('hex');
    }
  }

  // Metode aman tidak perlu divalidasi tokennya
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Izinkan bypass jika header X-Testing-Bypass aktif pada mode test
  if (process.env.NODE_ENV === 'test' && req.headers['x-testing-bypass'] === 'epresiden-test') {
    return next();
  }

  const clientToken = req.headers['x-csrf-token'] || (req.body && req.body._csrf);
  const sessionToken = req.session ? req.session.csrfToken : null;

  if (!sessionToken || !clientToken || clientToken !== sessionToken) {
    return res.status(403).json({
      success: false,
      error: 'Validasi token keamanan CSRF gagal. Silakan muat ulang halaman dan coba kembali.'
    });
  }

  next();
}

module.exports = {
  csrfMiddleware
};
