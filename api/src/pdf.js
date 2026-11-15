const PDFDocument = require('pdfkit');
const { disclaimer, options } = require('./shared');

const NAVY = '#0d2847';
const ORANGE = '#ea580c';
const MUTED = '#64748b';

const labelFor = (list, value) => list.find((o) => o.value === value)?.label ?? value;
const parseList = (value) => (Array.isArray(value) ? value : JSON.parse(value || '[]'));
const fullName = (v) => [v.first_name, v.middle_name, v.last_name].filter(Boolean).join(' ');

const formatUtc = (value) => {
  if (!value) return '—';
  const d = new Date(String(value).replace(' ', 'T') + (String(value).endsWith('Z') ? '' : 'Z'));
  if (Number.isNaN(d.getTime())) return String(value);
  const local = d.toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'long', timeStyle: 'short' });
  return `${local} ET (${d.toISOString().replace('T', ' ').slice(0, 19)} UTC)`;
};

const consentFileName = (v) =>
  `FSU-volunteer-consent-${fullName(v).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || v.id}.pdf`;

function signatureBlock(doc, title, name, png, at, ip) {
  if (doc.y > doc.page.height - 230) doc.addPage();
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.moveDown(0.8).font('Helvetica-Bold').fontSize(11).fillColor(NAVY).text(title);
  const top = doc.y + 6;
  doc.roundedRect(x, top, width, 110, 8).lineWidth(0.8).strokeColor('#cbd5e1').stroke();
  if (png) {
    try {
      doc.image(png, x + 12, top + 8, { fit: [260, 94], valign: 'center' });
    } catch {
      doc.font('Helvetica-Oblique').fontSize(10).fillColor(MUTED).text('(signature image unavailable)', x + 12, top + 45);
    }
  } else {
    doc.font('Helvetica-Oblique').fontSize(10).fillColor(MUTED).text('Accepted electronically (no drawn signature on file).', x + 12, top + 45, { width: 260 });
  }
  const tx = x + 290;
  doc.font('Helvetica').fontSize(9).fillColor(MUTED).text('Signed by', tx, top + 14);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text(name || '—', tx, top + 26, { width: width - 300 });
  doc.font('Helvetica').fontSize(9).fillColor(MUTED).text('Date / time', tx, top + 50);
  doc.fontSize(9).fillColor('#111827').text(formatUtc(at), tx, top + 62, { width: width - 300 });
  doc.fillColor(MUTED).text(`IP address: ${ip || '—'}`, tx, top + 88, { width: width - 300 });
  doc.x = x;
  doc.y = top + 122;
}

function buildConsentPdf(v) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 54, bottom: 54, left: 56, right: 56 },
      info: { Title: `Volunteer consent — ${fullName(v)}`, Author: 'Florida Sankranti Utsav' },
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const x = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    doc.rect(0, 0, doc.page.width, 96).fill(NAVY);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#fdba74').text('FLORIDA SANKRANTI UTSAV (TAMPA) 2027', x, 28, { characterSpacing: 1.2 });
    doc.font('Helvetica-Bold').fontSize(19).fillColor('#ffffff').text('Volunteer Disclaimer & Consent', x, 44);
    doc.font('Helvetica').fontSize(9).fillColor('#cbd5e1').text(`Record #${v.id} · Disclaimer version ${v.disclaimer_version}`, x, 70);
    doc.y = 120;

    doc.font('Helvetica-Bold').fontSize(12).fillColor(NAVY).text('Volunteer details', x);
    doc.moveDown(0.4);
    const rows = [
      ['Name', fullName(v)],
      ['Registering as', labelFor(options.accountTypes, v.account_type)],
      ['Email', v.email],
      ['Phone', v.phone || '—'],
    ];
    if (v.account_type === 'student') {
      rows.push(['Parent / guardian email', v.parent_email || '—'], ['Parent / guardian phone', v.parent_phone || '—']);
    }
    const interests = parseList(v.interests).map((i) => labelFor(options.interests, i));
    const availability = parseList(v.availability).map((i) => labelFor(options.availability, i));
    rows.push(
      ['Areas of interest', interests.join(', ') || '—'],
      ['Availability', availability.join(', ') || '—'],
      ['Registered', formatUtc(v.created_at)],
    );
    for (const [label, value] of rows) {
      const y = doc.y;
      doc.font('Helvetica').fontSize(9.5).fillColor(MUTED).text(label, x, y, { width: 150 });
      doc.font('Helvetica').fontSize(9.5).fillColor('#111827').text(String(value), x + 155, y, { width: width - 155 });
      doc.moveDown(0.25);
    }

    doc.moveDown(0.8).moveTo(x, doc.y).lineTo(x + width, doc.y).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
    doc.moveDown(0.8).font('Helvetica-Bold').fontSize(12).fillColor(NAVY).text(disclaimer.title, x);
    doc.moveDown(0.3).font('Helvetica').fontSize(9.5).fillColor('#334155').text(disclaimer.intro, { width });
    for (const s of disclaimer.sections) {
      doc.moveDown(0.5).font('Helvetica-Bold').fontSize(9.5).fillColor('#111827').text(s.heading, { width });
      doc.moveDown(0.1).font('Helvetica').fontSize(9.5).fillColor('#334155').text(s.body, { width, align: 'justify' });
    }
    doc.moveDown(0.5).font('Helvetica-Oblique').fontSize(9.5).fillColor('#334155').text(disclaimer.closing, { width });

    signatureBlock(
      doc,
      v.account_type === 'student' ? 'Student acknowledgement' : 'Volunteer signature',
      v.signature_name,
      v.signature_png,
      v.disclaimer_accepted_at,
      v.accepted_ip,
    );
    if (v.account_type === 'student') {
      if (v.parent_consent_status === 'confirmed') {
        signatureBlock(doc, 'Parent / guardian consent', v.parent_signature_name, v.parent_signature_png, v.parent_consent_at, v.parent_consent_ip);
      } else {
        doc.moveDown(0.8).font('Helvetica-Bold').fontSize(10).fillColor(ORANGE).text('Parent / guardian consent: PENDING', x);
      }
    }

    doc.moveDown(1).font('Helvetica').fontSize(8).fillColor(MUTED).text(
      'This document was generated electronically by floridasankrantiutsav.com from the registration record. Questions: info@floridasankrantiutsav.com',
      x, doc.y, { width },
    );
    doc.end();
  });
}

module.exports = { buildConsentPdf, consentFileName, fullName };
