const crypto = require('node:crypto');
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const config = require('./config');
const { pool, migrate } = require('./db');
const mailer = require('./mailer');
const { escape, page } = require('./html');
const { disclaimer } = require('./shared');
const { validateRegistration } = require('./validate');
const { parseSignatureImage, parseSignatureName } = require('./signature');
const { afterSignature, backfillConsentPdfs } = require('./consent');
const adminRouter = require('./admin');

const app = express();
app.set('trust proxy', /^\d+$/.test(config.trustProxy) ? Number(config.trustProxy) : config.trustProxy);
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '256kb' }));

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

  let insertId;
  try {
    const [result] = await pool.execute(
      `INSERT INTO volunteers
        (account_type, first_name, middle_name, last_name, email, phone, parent_email, parent_phone,
         interests, availability, notes, disclaimer_version, disclaimer_accepted_at, accepted_ip, user_agent,
         parent_consent_status, parent_consent_token, signature_name, signature_png)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), ?, ?, ?, ?, ?, ?)`,
      [
        v.accountType, v.firstName, v.middleName, v.lastName, v.email, v.phone, v.parentEmail, v.parentPhone,
        JSON.stringify(v.interests), JSON.stringify(v.availability), v.notes, disclaimer.version,
        req.ip ?? null, (req.get('user-agent') || '').slice(0, 255) || null,
        isStudent ? 'pending' : 'not_required', token, v.signatureName, v.signaturePng,
      ],
    );
    insertId = result.insertId;
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
  afterSignature(insertId).catch((err) => console.error('Failed to create consent PDF:', err));
  if (isStudent) mailer.send({
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
      text: `Hello,\n\n${name} (${v.email}) registered as a student volunteer for Florida Sankranti Utsav (Tampa) 2027 and listed you as their parent/guardian.\n\nPlease review the disclaimer and confirm your consent here:\n${consentUrl(token)}\n\nIf you did not expect this email, you can ignore it and no consent will be recorded. Once you sign, a PDF copy of the signed consent is emailed to you and ${v.firstName}.\n\nFlorida Sankranti Utsav Team\ninfo@floridasankrantiutsav.com`,
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

const confirmedPage = (v, justSigned = false) =>
  page(
    'Consent confirmed',
    `<div class="top"><small>FLORIDA SANKRANTI UTSAV</small><h1>Consent confirmed</h1></div>
     <div class="content"><p class="ok">Thank you. Your consent for ${escape(fullName(v))} has been recorded.</p>
     ${justSigned && mailer.enabled ? '<p>A PDF copy of the signed consent is on its way to your email.</p>' : ''}
     <p><a href="${escape(config.publicUrl)}/">Back to Florida Sankranti Utsav</a></p></div>`,
  );

const signatureFields = (error) => `
  <label for="sig-name" style="display:block;font-weight:700;color:#0d2847;margin-bottom:6px">Parent / guardian full name (typed signature) *</label>
  <input id="sig-name" name="signatureName" required minlength="2" maxlength="160" autocomplete="name"
         style="width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid #cbd5e1;border-radius:12px;font:inherit;margin-bottom:14px">
  <div style="display:flex;justify-content:space-between;align-items:baseline">
    <span style="font-weight:700;color:#0d2847">Draw your signature *</span>
    <button type="button" id="sig-clear" style="background:none;color:#ea580c;padding:4px 0;font-size:14px">Clear</button>
  </div>
  <canvas id="sig-pad" aria-label="Signature pad" style="display:block;width:100%;height:170px;border:1px dashed #94a3b8;border-radius:12px;background:#fff;touch-action:none;cursor:crosshair;margin:6px 0 4px"></canvas>
  <small style="color:#64748b">Sign with your mouse, finger or stylus.</small>
  <input type="hidden" name="signatureImage" id="sig-image">
  <p id="sig-error" role="alert" style="color:#b91c1c;font-weight:600;margin:8px 0 0">${escape(error || '')}</p>
  <div style="height:16px"></div>`;

const SIGNATURE_SCRIPT = `<script>
(function () {
  var canvas = document.getElementById('sig-pad'), ctx = canvas.getContext('2d'), drawn = false, last = null;
  function size() {
    var r = canvas.getBoundingClientRect(), d = window.devicePixelRatio || 1;
    canvas.width = r.width * d; canvas.height = r.height * d;
    ctx.setTransform(d, 0, 0, d, 0, 0); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0f172a';
    drawn = false;
  }
  function pos(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  canvas.addEventListener('pointerdown', function (e) { canvas.setPointerCapture(e.pointerId); last = pos(e); ctx.beginPath(); ctx.arc(last.x, last.y, 1.2, 0, 7); ctx.fill(); drawn = true; document.getElementById('sig-error').textContent = ''; });
  canvas.addEventListener('pointermove', function (e) { if (!last) return; var p = pos(e); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p; });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) { canvas.addEventListener(t, function () { last = null; }); });
  document.getElementById('sig-clear').addEventListener('click', size);
  document.getElementById('consent').addEventListener('submit', function (e) {
    if (!drawn) { e.preventDefault(); document.getElementById('sig-error').textContent = 'Please draw your signature in the box.'; return; }
    var k = Math.min(1, 600 / canvas.width), out = document.createElement('canvas');
    out.width = Math.round(canvas.width * k); out.height = Math.round(canvas.height * k);
    out.getContext('2d').drawImage(canvas, 0, 0, out.width, out.height);
    document.getElementById('sig-image').value = out.toDataURL('image/png');
  });
  size();
})();
</script>`;

async function consentPage(res, v, error) {
  const terms = disclaimer.sections
    .map((s) => `<h3>${escape(s.heading)}</h3><p>${escape(s.body)}</p>`)
    .join('');
  res.status(error ? 400 : 200).type('html').send(
    page(
      'Parent / guardian consent',
      `<div class="top"><small>FLORIDA SANKRANTI UTSAV · PARENT / GUARDIAN CONSENT</small><h1>Confirm consent for ${escape(fullName(v))}</h1></div>
         <div class="content">
           <p>${escape(fullName(v))} (${escape(v.email)}) registered as a student volunteer and listed <strong>${escape(v.parent_email)}</strong> as their parent / guardian. Please review the terms below.</p>
           <div class="terms"><h3>${escape(disclaimer.title)}</h3><p>${escape(disclaimer.intro)}</p>${terms}<p><em>${escape(disclaimer.closing)}</em></p></div>
           <form method="post" id="consent" style="margin-top:20px">
             <label style="display:flex;gap:10px;align-items:flex-start;margin-bottom:18px">
               <input type="checkbox" name="agree" value="yes" required style="margin-top:5px">
               <span>I am the parent or legal guardian of ${escape(fullName(v))}, and I have read and agree to the disclaimer and waiver on their behalf.</span>
             </label>
             ${signatureFields(error)}
             <button type="submit">Sign and confirm consent</button>
           </form>
           ${SIGNATURE_SCRIPT}
         </div>`,
    ),
  );
}

app.get('/api/volunteers/consent/:token', async (req, res, next) => {
  try {
    const v = await findByToken(req.params.token);
    if (!v) return res.status(404).type('html').send(notFound);
    if (v.parent_consent_status === 'confirmed') return res.type('html').send(confirmedPage(v));
    await consentPage(res, v);
  } catch (err) {
    next(err);
  }
});

app.post('/api/volunteers/consent/:token', async (req, res, next) => {
  try {
    const v = await findByToken(req.params.token);
    if (!v) return res.status(404).type('html').send(notFound);
    if (v.parent_consent_status === 'confirmed') return res.type('html').send(confirmedPage(v));
    if (req.body?.agree !== 'yes') return consentPage(res, v, 'Please tick the consent checkbox.');
    const signatureName = parseSignatureName(req.body?.signatureName);
    if (!signatureName) return consentPage(res, v, 'Please type your full name as your signature.');
    const signaturePng = parseSignatureImage(req.body?.signatureImage);
    if (!signaturePng) return consentPage(res, v, 'Please draw your signature in the box.');

    const [result] = await pool.execute(
      `UPDATE volunteers SET parent_consent_status = 'confirmed', parent_consent_at = UTC_TIMESTAMP(), parent_consent_ip = ?,
         parent_signature_name = ?, parent_signature_png = ?
       WHERE id = ? AND parent_consent_status = 'pending'`,
      [req.ip ?? null, signatureName, signaturePng, v.id],
    );
    if (result.affectedRows) {
      afterSignature(v.id).catch((err) => console.error('Failed to create consent PDF:', err));
    }
    res.type('html').send(confirmedPage(v, true));
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
    .then(() => backfillConsentPdfs().catch((err) => console.error('Consent PDF backfill failed:', err)))
    .then(() => {
      app.listen(config.port, () => console.log(`Volunteer API listening on :${config.port}`));
    })
    .catch((err) => {
      console.error('Database migration failed:', err);
      process.exit(1);
    });
}

module.exports = app;
