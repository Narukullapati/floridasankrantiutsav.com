const test = require('node:test');
const assert = require('node:assert/strict');
const { parseSignatureImage, parseSignatureName } = require('../src/signature');
const { buildConsentPdf } = require('../src/pdf');
const { disclaimer } = require('../src/shared');
const { samplePng, sampleDataUrl } = require('./helpers');

test('accepts a PNG data URL and rejects anything else', () => {
  assert.ok(parseSignatureImage(sampleDataUrl()).equals(samplePng()));
  assert.equal(parseSignatureImage(undefined), null);
  assert.equal(parseSignatureImage('data:image/jpeg;base64,AAAA'), null);
  assert.equal(parseSignatureImage(`data:image/png;base64,${Buffer.from('not a png at all'.repeat(10)).toString('base64')}`), null);
  assert.equal(parseSignatureImage(`data:image/png;base64,${'A'.repeat(300 * 1024)}`), null);
});

test('typed signature name is trimmed and length-checked', () => {
  assert.equal(parseSignatureName('  Anu   Reddy '), 'Anu Reddy');
  assert.equal(parseSignatureName('A'), null);
  assert.equal(parseSignatureName('x'.repeat(161)), null);
});

test('builds a PDF with volunteer and parent signatures', async () => {
  const pdf = await buildConsentPdf({
    id: 7, account_type: 'student', first_name: 'Anu', middle_name: null, last_name: 'Reddy',
    email: 'anu@example.com', phone: null, parent_email: 'mom@example.com', parent_phone: '8135550101',
    interests: '["food"]', availability: '[]', disclaimer_version: disclaimer.version,
    disclaimer_accepted_at: '2026-11-15 17:00:00', accepted_ip: '203.0.113.5', created_at: '2026-11-15 17:00:00',
    signature_name: 'Anu Reddy', signature_png: samplePng(),
    parent_consent_status: 'confirmed', parent_consent_at: '2026-11-15 18:00:00', parent_consent_ip: '203.0.113.6',
    parent_signature_name: 'Lakshmi Reddy', parent_signature_png: samplePng(),
  });
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok(pdf.length > 2000);
});
