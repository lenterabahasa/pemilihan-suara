/**
 * In-memory sliding window rate limiter untuk Express
 */
function createRateLimiter({ windowMs = 60 * 1000, max = 60, message = 'Terlalu banyak permintaan. Silakan coba lagi nanti.' }) {
  const requests = new Map();

  return (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;

    let timestamps = requests.get(key) || [];
    timestamps = timestamps.filter(ts => ts > windowStart);

    if (timestamps.length >= max) {
      return res.status(429).json({
        success: false,
        error: message,
        retryAfterMs: windowMs - (now - timestamps[0])
      });
    }

    timestamps.push(now);
    requests.set(key, timestamps);

    // Pembersihan periodik jika map membesar
    if (requests.size > 5000) {
      for (const [k, tsList] of requests.entries()) {
        const valid = tsList.filter(ts => ts > windowStart);
        if (valid.length === 0) requests.delete(k);
        else requests.set(k, valid);
      }
    }

    next();
  };
}

const loginRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 menit
  max: 10,
  message: 'Batas percobaan login tercapai. Demi keamanan, silakan tunggu beberapa menit sebelum mencoba kembali.'
});

const voteRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 menit
  max: 5,
  message: 'Terlalu banyak permintaan pemungutan suara dalam waktu singkat. Silakan tunggu sebentar.'
});

const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 menit
  max: 120,
  message: 'Terlalu banyak permintaan API. Harap perlambat laju request Anda.'
});

module.exports = {
  createRateLimiter,
  loginRateLimiter,
  voteRateLimiter,
  apiRateLimiter
};
