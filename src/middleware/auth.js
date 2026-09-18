const { handleUnauthorizedAccess } = require('../services/antiFraudService');

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
      return res.status(401).json({ success: false, error: 'Sesi Anda telah berakhir atau belum login. Silakan login kembali.' });
    }
    return res.redirect('/login.html');
  }
  next();
}

function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
        return res.status(401).json({ success: false, error: 'Silakan login terlebih dahulu.' });
      }
      return res.redirect('/login.html');
    }

    if (!roles.includes(req.session.user.role)) {
      // Catat sebagai percobaan akses tidak sah ke Anti-Fraud System
      handleUnauthorizedAccess(req, roles.join(', '));

      if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
        return res.status(403).json({
          success: false,
          error: 'Akses Ditolak: Anda tidak memiliki hak akses untuk fungsi ini.'
        });
      }
      return res.status(403).send(`
        <div style="font-family:sans-serif; text-align:center; padding: 50px;">
          <h1 style="color:#b91c1c;">403 - Akses Ditolak</h1>
          <p>Peran Anda (${req.session.user.role}) tidak diizinkan mengakses halaman ini.</p>
          <a href="/" style="color:#1d4ed8; text-decoration:underline;">Kembali ke Beranda</a>
        </div>
      `);
    }

    next();
  };
}

module.exports = {
  requireAuth,
  requireRole
};
