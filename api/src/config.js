const path = require('node:path');

const env = process.env;

module.exports = {
  port: Number(env.PORT || 3000),
  publicUrl: (env.PUBLIC_URL || 'http://localhost:4200').replace(/\/+$/, ''),
  trustProxy: env.TRUST_PROXY ?? '2',
  db: {
    host: env.DB_HOST || 'localhost',
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER || 'fsu',
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME || 'fsu',
  },
  admin: {
    user: env.ADMIN_USER || 'admin',
    password: env.ADMIN_PASSWORD || '',
  },
  smtp: {
    host: env.SMTP_HOST || '',
    port: Number(env.SMTP_PORT || 587),
    secure: env.SMTP_SECURE === 'true',
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    from: env.SMTP_FROM || 'Florida Sankranti Utsav <info@floridasankrantiutsav.com>',
  },
  sharedDir: env.SHARED_DIR || path.join(__dirname, '../../src/app/sections/volunteer'),
};
