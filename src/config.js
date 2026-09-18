const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

module.exports = {
  PORT: process.env.PORT || 3000,
  SESSION_SECRET: process.env.SESSION_SECRET || 'epresiden-simulasi-secret-key-2026',
  NODE_ENV: process.env.NODE_ENV || 'development',
  DB_PATH: path.resolve(process.env.DB_PATH || path.join(__dirname, '..', 'data', 'epresiden.sqlite'))
};
