const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { pool } = require('./db');
const { options } = require('./shared');
const { checkCredentials, setSession, clearSession, requireAdmin } = require('./auth');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many sign-in attempts. Please wait 15 minutes and try again.' },
});

const labelFor = (list, value) => list.find((o) => o.value === value)?.label ?? value;
const parseList = (value) => (Array.isArray(value) ? value : JSON.parse(value || '[]'));

const toVolunteer = (r) => ({
  id: r.id,
  accountType: r.account_type,
  accountTypeLabel: labelFor(options.accountTypes, r.account_type),
  firstName: r.first_name,
  middleName: r.middle_name,
  lastName: r.last_name,
  email: r.email,
  phone: r.phone,
  parentEmail: r.parent_email,
  parentPhone: r.parent_phone,
  interests: parseList(r.interests).map((x) => labelFor(options.interests, x)),
  availability: parseList(r.availability).map((x) => labelFor(options.availability, x)),
  notes: r.notes,
  disclaimerVersion: r.disclaimer_version,
  disclaimerAcceptedAt: r.disclaimer_accepted_at,
  acceptedIp: r.accepted_ip,
  userAgent: r.user_agent,
  parentConsentStatus: r.parent_consent_status,
  parentConsentAt: r.parent_consent_at,
  parentConsentIp: r.parent_consent_ip,
  createdAt: r.created_at,
});

const csvCell = (value) => {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const listVolunteers = async () => {
  const [rows] = await pool.query('SELECT * FROM volunteers ORDER BY created_at DESC, id DESC');
  return rows.map(toVolunteer);
};

router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== 'string' || typeof password !== 'string' || !checkCredentials(username, password)) {
    return res.status(401).json({ message: 'Incorrect username or password.' });
  }
  setSession(req, res, username);
  res.json({ user: username });
});

router.post('/logout', (req, res) => {
  clearSession(req, res);
  res.status(204).end();
});

router.use(requireAdmin);

router.get('/me', (req, res) => res.json({ user: req.adminUser }));

router.get('/volunteers', async (_req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store').json({ volunteers: await listVolunteers() });
  } catch (err) {
    next(err);
  }
});

router.delete('/volunteers/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'Invalid volunteer id.' });
  try {
    const [result] = await pool.execute('DELETE FROM volunteers WHERE id = ?', [id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Volunteer not found.' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.get('/volunteers.csv', async (_req, res, next) => {
  try {
    const rows = (await listVolunteers()).reverse();
    const header = [
      'ID', 'Registered (UTC)', 'Account type', 'First name', 'Middle name', 'Last name', 'Email', 'Phone',
      'Parent email', 'Parent phone', 'Parent consent', 'Parent consent at (UTC)', 'Interests', 'Availability',
      'Notes', 'Disclaimer version', 'Disclaimer accepted (UTC)', 'IP',
    ];
    const lines = rows.map((v) =>
      [
        v.id, v.createdAt, v.accountTypeLabel, v.firstName, v.middleName, v.lastName, v.email, v.phone,
        v.parentEmail, v.parentPhone, v.parentConsentStatus, v.parentConsentAt, v.interests.join('; '),
        v.availability.join('; '), v.notes, v.disclaimerVersion, v.disclaimerAcceptedAt, v.acceptedIp,
      ].map(csvCell).join(','),
    );
    res
      .type('text/csv')
      .set('Cache-Control', 'no-store')
      .set('Content-Disposition', 'attachment; filename="fsu-volunteers.csv"')
      .send([header.join(','), ...lines].join('\r\n') + '\r\n');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
