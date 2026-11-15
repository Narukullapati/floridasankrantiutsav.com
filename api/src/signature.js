const PREFIX = 'data:image/png;base64,';
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_BYTES = 150 * 1024;

function parseSignatureImage(value) {
  if (typeof value !== 'string' || !value.startsWith(PREFIX)) return null;
  const b64 = value.slice(PREFIX.length);
  if (!b64 || b64.length > Math.ceil(MAX_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return null;
  const png = Buffer.from(b64, 'base64');
  if (png.length < 100 || png.length > MAX_BYTES || !png.subarray(0, 8).equals(PNG_MAGIC)) return null;
  return png;
}

function parseSignatureName(value) {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  return name.length >= 2 && name.length <= 160 ? name : null;
}

module.exports = { parseSignatureImage, parseSignatureName };
