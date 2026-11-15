const config = require('./config');
const { pool } = require('./db');
const mailer = require('./mailer');
const { buildConsentPdf, consentFileName, fullName } = require('./pdf');

async function findVolunteer(id) {
  const [rows] = await pool.execute('SELECT * FROM volunteers WHERE id = ?', [id]);
  return rows[0] ?? null;
}

const isConsentComplete = (v) => v.account_type !== 'student' || v.parent_consent_status === 'confirmed';

async function saveConsentPdf(id) {
  const v = await findVolunteer(id);
  if (!v) return null;
  const pdf = await buildConsentPdf(v);
  await pool.execute('UPDATE volunteers SET consent_pdf = ?, consent_pdf_generated_at = UTC_TIMESTAMP() WHERE id = ?', [pdf, id]);
  return { v, pdf };
}

async function storedConsentPdf(id) {
  const v = await findVolunteer(id);
  if (!v) return null;
  if (v.consent_pdf) return { v, pdf: v.consent_pdf };
  return saveConsentPdf(id);
}

async function backfillConsentPdfs() {
  const [rows] = await pool.query('SELECT id FROM volunteers WHERE consent_pdf IS NULL');
  for (const { id } of rows) await saveConsentPdf(id);
  return rows.length;
}

async function afterSignature(id) {
  const saved = await saveConsentPdf(id);
  if (saved && mailer.enabled && isConsentComplete(saved.v)) await sendConsentPdf(id);
}

async function sendConsentPdf(id) {
  const stored = await storedConsentPdf(id);
  if (!stored || !isConsentComplete(stored.v)) return false;

  const { v, pdf } = stored;
  const student = v.account_type === 'student';
  const to = [v.email, student ? v.parent_email : null].filter(Boolean);
  const sent = await mailer.send({
    to,
    bcc: config.consentPdfBcc.length ? config.consentPdfBcc : undefined,
    subject: `Signed volunteer consent: ${fullName(v)} — Florida Sankranti Utsav 2027`,
    text: `Hello,\n\n${
      student
        ? `Thank you. Parent/guardian consent for ${fullName(v)} has been recorded.`
        : `Thank you for registering as a volunteer, ${v.first_name}.`
    } A copy of the signed disclaimer and consent is attached for your records.\n\nFlorida Sankranti Utsav (Tampa) 2027 — January 16, 2027 at Jyohas Farms, Zephyrhills, FL.\n\nFlorida Sankranti Utsav Team\ninfo@floridasankrantiutsav.com`,
    attachments: [{ filename: consentFileName(v), content: pdf, contentType: 'application/pdf' }],
  });
  if (sent) await pool.execute('UPDATE volunteers SET consent_pdf_sent_at = UTC_TIMESTAMP() WHERE id = ?', [id]);
  return sent;
}

module.exports = {
  afterSignature,
  backfillConsentPdfs,
  findVolunteer,
  isConsentComplete,
  saveConsentPdf,
  sendConsentPdf,
  storedConsentPdf,
};
