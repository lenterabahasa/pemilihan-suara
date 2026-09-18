const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const config = require('./config');
const { initSchema } = require('./db/schema');
const { apiRateLimiter } = require('./middleware/rateLimiter');

// Inisialisasi skema database saat server booting
initSchema();

const app = express();

// Security Headers dengan Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

// Body parser
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Session management
app.use(
  session({
    name: 'epresiden.sid',
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 4 * 60 * 60 * 1000 // 4 jam
    }
  })
);

// API Rate Limiting umum
app.use('/api/', apiRateLimiter);

// File Statis (Frontend)
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/vote', require('./routes/votingRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/audit', require('./routes/auditRoutes'));

// Fallback untuk halaman SPA / Route HTML
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});
app.get('/auditor', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'auditor.html'));
});
app.get('/bilik-suara', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'bilik-suara.html'));
});
app.get('/hasil', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'hasil.html'));
});
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

// Penanganan 404
app.use((req, res) => {
  if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
    return res.status(404).json({ success: false, error: 'Endpoint API tidak ditemukan.' });
  }
  res.status(404).sendFile(path.join(__dirname, '..', 'public', '404.html'));
});

// Penanganan Error Terpusat (Tanpa membocorkan stack trace sensitif)
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]:', err);
  res.status(err.status || 500).json({
    success: false,
    error: config.NODE_ENV === 'production' 
      ? 'Terjadi kesalahan pada sistem pemilu. Silakan hubungi administrator.' 
      : (err.message || 'Internal Server Error')
  });
});

// Jalankan server jika dipanggil langsung
if (require.main === module) {
  const server = app.listen(config.PORT, () => {
    console.log(`====================================================`);
    console.log(`  E-PRESIDEN: Sistem Pemilihan Presiden Digital      `);
    console.log(`  Satu Pemilih, Satu Suara, Suara Rahasia & Terpelihara`);
    console.log(`====================================================`);
    console.log(`  URL Server: http://localhost:${config.PORT}`);
    console.log(`  Lingkungan: ${config.NODE_ENV}`);
    console.log(`====================================================`);
  });

  process.on('SIGINT', () => {
    console.log('\n[Shutdown] Menutup server E-PRESIDEN secara aman...');
    server.close(() => {
      console.log('[Shutdown] Server ditutup.');
      process.exit(0);
    });
  });
}

module.exports = app;
