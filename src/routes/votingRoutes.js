const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { voteRateLimiter } = require('../middleware/rateLimiter');
const { csrfMiddleware } = require('../middleware/csrf');
const votingService = require('../services/votingService');

const router = express.Router();

/**
 * Daftar kandidat untuk bilik suara
 */
router.get('/candidates', (req, res) => {
  try {
    const candidates = votingService.getCandidates();
    res.json({ success: true, candidates });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Cek status pemilih dan informasi pemilihan saat ini
 */
router.get('/status', (req, res) => {
  try {
    const settings = votingService.getElectionSettings();
    let voterStatus = null;

    if (req.session && req.session.user) {
      voterStatus = {
        hasVoted: req.session.user.has_voted === 1,
        voterId: req.session.user.voter_id,
        name: req.session.user.name,
        role: req.session.user.role
      };
    }

    res.json({
      success: true,
      election: {
        id: settings.id,
        name: settings.name,
        startTime: settings.start_time,
        endTime: settings.end_time,
        status: settings.status
      },
      voter: voterStatus
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Pemungutan Suara (Cast Vote)
 * Wajib: Login sebagai 'voter', lolos CSRF, lolos rate limit, atomik
 */
router.post('/cast', requireAuth, requireRole('voter'), voteRateLimiter, csrfMiddleware, (req, res) => {
  const { candidateId } = req.body;
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';

  if (!candidateId) {
    return res.status(400).json({
      success: false,
      error: 'ID Kandidat wajib dipilih.'
    });
  }

  try {
    const result = votingService.castVote(req.session.user.id, Number(candidateId), ip);
    // Sinkronkan status sesi
    req.session.user.has_voted = 1;

    res.json({
      success: true,
      message: result.message,
      receiptToken: result.receiptToken,
      timestamp: result.timestamp
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * Mengambil rekapitulasi hasil
 */
router.get('/results', (req, res) => {
  try {
    const userRole = req.session && req.session.user ? req.session.user.role : 'guest';
    const results = votingService.getResults(userRole);
    res.json({ success: true, ...results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
