const mysql = require('mysql2/promise');
const config = require('./config');

const pool = mysql.createPool({
  ...config.db,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: 'Z',
  dateStrings: true,
});

const SCHEMA = `
CREATE TABLE IF NOT EXISTS volunteers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  account_type ENUM('student', 'parent', 'volunteer') NOT NULL,
  first_name VARCHAR(80) NOT NULL,
  middle_name VARCHAR(80) NULL,
  last_name VARCHAR(80) NOT NULL,
  email VARCHAR(254) NOT NULL,
  phone VARCHAR(20) NULL,
  parent_email VARCHAR(254) NULL,
  parent_phone VARCHAR(20) NULL,
  interests JSON NOT NULL,
  availability JSON NOT NULL,
  notes TEXT NULL,
  disclaimer_version VARCHAR(20) NOT NULL,
  disclaimer_accepted_at DATETIME NOT NULL,
  accepted_ip VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  parent_consent_status ENUM('not_required', 'pending', 'confirmed') NOT NULL,
  parent_consent_token CHAR(64) NULL,
  parent_consent_at DATETIME NULL,
  parent_consent_ip VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_volunteers_email (email),
  UNIQUE KEY uq_volunteers_consent_token (parent_consent_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

const COLUMNS = {
  signature_name: 'VARCHAR(160) NULL',
  signature_png: 'MEDIUMBLOB NULL',
  parent_signature_name: 'VARCHAR(160) NULL',
  parent_signature_png: 'MEDIUMBLOB NULL',
  consent_pdf_sent_at: 'DATETIME NULL',
  consent_pdf: 'MEDIUMBLOB NULL',
  consent_pdf_generated_at: 'DATETIME NULL',
};

async function addMissingColumns() {
  const [rows] = await pool.query(
    "SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'volunteers'",
  );
  const existing = new Set(rows.map((r) => r.name));
  for (const [name, type] of Object.entries(COLUMNS)) {
    if (!existing.has(name)) await pool.query(`ALTER TABLE volunteers ADD COLUMN ${name} ${type}`);
  }
}

async function migrate({ retries = 30, delayMs = 2000 } = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      await pool.query(SCHEMA);
      await addMissingColumns();
      return;
    } catch (err) {
      if (attempt >= retries) throw err;
      console.warn(`Database not ready (${err.code || err.message}); retrying in ${delayMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

module.exports = { pool, migrate };
