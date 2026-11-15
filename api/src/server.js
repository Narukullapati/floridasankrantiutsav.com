const crypto = require('node:crypto');
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const config = require('./config');
const { pool, migrate } = require('./db');
const mailer = require('./mailer');
const { escape, page } = require('./html');
const { disclaimer } = require('./shared');
const { validateRegistration } = require('./validate');
const adminRouter = require('./admin');

const app = express();
app.set('trust proxy', /^\d+$/.test(config.trustProxy) ? Number(config.trustProxy) : config.trustProxy);
app.disable('x-powered-by');
app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: false, limit: '2kb' }));

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many registrations from this network. Please try again later.' },
});

const fullName = (v) => [v.first_name, v.middle_name, v.last_name].filter(Boolean).join(' ');
const consentUrl = (token) => `${config.publicUrl}/api/volunteers/consent/${token}`;

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'db_unavailable' });
  }
});

app.post('/api/volunteers', registerLimiter, async (req, res) => {
  if (req.body?.website) {
    return res.status(201).json({ message: 'Registration received.' });
  }

  const { errors, value: v } = validateRegistration(req.body);
  if (Object.keys(errors).length) {
    return res.status(400).json({ message: 'Please correct the highlighted fields.', errors });
  }

  const isStudent = v.accountType === 'student';
  const token = isStudent ? crypto.randomBytes(32).toString('hex') : null;

  try {
    await pool.execute(
      `INSERT INTO volunteers
        (account_type, first_name, middle_name, last_name, email, phone, parent_email, parent_phone,
         interests, availability, notes, disclaimer_version, disclaimer_accepted_at, accepted_ip, user_agent,
         parent_consent_status, parent_consent_token)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), ?, ?, ?, ?)`,
      [
        v.accountType, v.firstName, v.middleName, v.lastName, v.email, v.phone, v.parentEmail, v.parentPhone,
        JSON.stringify(v.interests), JSON.stringify(v.availability), v.notes, disclaimer.version,
        req.ip ?? null, (req.get('user-agent') || '').slice(0, 255) || null,
        isStudent ? 'pending' : 'not_required', token,
      ],
    );
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        message: 'This email is already registered as a volunteer.',
        errors: { email: 'This email is already registered.' },
      });
    }
    console.error('Failed to save volunteer:', err);
    return res.status(500).json({ message: 'We could not save your registration. Please try again shortly.' });
  }

  const name = `${v.firstName} ${v.lastName}`;
  mailer.send({
    to: v.email,
    subject: 'Thank you for volunteering at Florida Sankranti Utsav 2027',
    text: `Hi ${v.firstName},\n\nThank you for registering as a volunteer for Florida Sankranti Utsav (Tampa) 2027 on January 16, 2027 at Jyohas Farms, Zephyrhills, FL.${
      isStudent ? `\n\nWe have emailed your parent/guardian (${v.parentEmail}) to confirm consent. You can volunteer once they confirm.` : ''
    }\n\nWe will contact you with your assignment closer to the event.\n\nFlorida Sankranti Utsav Team\ninfo@floridasankrantiutsav.com`,
  });
  if (isStudent) {
    mailer.send({
      to: v.parentEmail,
      subject: `Please confirm consent for ${name} to volunteer at Florida Sankranti Utsav`,
      text: `Hello,\n\n${name} (${v.email}) registered as a student volunteer for Florida Sankranti Utsav (Tampa) 2027 and listed you as their parent/guardian.\n\nPlease review the disclaimer and confirm your consent here:\n${consentUrl(token)}\n\nIf you did not expect this email, you can ignore it and no consent will be recorded.\n\nFlorida Sankranti Utsav Team\ninfo@floridasankrantiutsav.com`,
    });
  }

  return res.status(201).json({
    message: 'Registration received.',
    parentConsentRequired: isStudent,
    emailSent: mailer.enabled,
  });
});

async function findByToken(token) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const [rows] = await pool.execute(
    'SELECT id, first_name, middle_name, last_name, email, parent_email, parent_consent_status FROM volunteers WHERE parent_consent_token = ?',
    [token],
  );
  return rows[0] ?? null;
}

const notFound = page(
  'Link not valid',
  `<div class="top"><small>FLORIDA SANKRANTI UTSAV</small><h1>Link not valid</h1></div>
   <div class="content"><p>This consent link is invalid or has expired. Please contact <a href="mailto:info@floridasankrantiutsav.com">info@floridasankrantiutsav.com</a>.</p></div>`,
);

const confirmedPage = (v) =>
  page(
    'Consent confirmed',
    `<div class="top"><small>FLORIDA SANKRANTI UTSAV</small><h1>Consent confirmed</h1></div>
     <div class="content"><p class="ok">Thank you. Your consent for ${escape(fullName(v))} has been recorded.</p>
     <p><a href="${escape(config.publicUrl)}/">Back to Florida Sankranti Utsav</a></p></div>`,
  );

app.get('/api/volunteers/consent/:token', async (req, res, next) => {
  try {
    const v = await findByToken(req.params.token);
    if (!v) return res.status(404).type('html').send(notFound);
    if (v.parent_consent_status === 'confirmed') return res.type('html').send(confirmedPage(v));

    const terms = disclaimer.sections
      .map((s) => `<h3>${escape(s.heading)}</h3><p>${escape(s.body)}</p>`)
      .join('');
    res.type('html').send(
      page(
        'Parent / guardian consent',
        `<div class="top"><small>FLORIDA SANKRANTI UTSAV · PARENT / GUARDIAN CONSENT</small><h1>Confirm consent for ${escape(fullName(v))}</h1></div>
         <div class="content">
           <p>${escape(fullName(v))} (${escape(v.email)}) registered as a student volunteer and listed <strong>${escape(v.parent_email)}</strong> as their parent / guardian. Please review the terms below.</p>
           <div class="terms"><h3>${escape(disclaimer.title)}</h3><p>${escape(disclaimer.intro)}</p>${terms}<p><em>${escape(disclaimer.closing)}</em></p></div>
           <form method="post" style="margin-top:20px">
             <label style="display:flex;gap:10px;align-items:flex-start;margin-bottom:18px">
               <input type="checkbox" name="agree" value="yes" required style="margin-top:5px">
               <span>I am the parent or legal guardian of ${escape(fullName(v))}, and I have read and agree to the disclaimer and waiver on their behalf.</span>
             </label>
             <button type="submit">Confirm consent</button>
           </form>
         </div>`,
      ),
    );
  } catch (err) {
    next(err);
  }
});

app.post('/api/volunteers/consent/:token', async (req, res, next) => {
  try {
    const v = await findByToken(req.params.token);
    if (!v) return res.status(404).type('html').send(notFound);
    if (req.body?.agree !== 'yes') return res.redirect(303, req.originalUrl);
    if (v.parent_consent_status !== 'confirmed') {
      await pool.execute(
        `UPDATE volunteers SET parent_consent_status = 'confirmed', parent_consent_at = UTC_TIMESTAMP(), parent_consent_ip = ?
         WHERE id = ? AND parent_consent_status = 'pending'`,
        [req.ip ?? null, v.id],
      );
    }
    res.type('html').send(confirmedPage(v));
  } catch (err) {
    next(err);
  }
});

app.use('/api/admin', adminRouter);

app.use('/api', (_req, res) => res.status(404).json({ message: 'Not found.' }));

app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid request body.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ message: 'Request is too large.' });
  console.error(err);
  res.status(500).json({ message: 'Something went wrong.' });
});

if (require.main === module) {
  migrate()
    .then(() => {
      app.listen(config.port, () => console.log(`Volunteer API listening on :${config.port}`));
    })
    .catch((err) => {
      console.error('Database migration failed:', err);
      process.exit(1);
    });
}

module.exports = app;
