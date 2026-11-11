const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

function page(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escape(title)} | Florida Sankranti Utsav</title>
<style>
  body { margin: 0; background: #fff7ed; font-family: Inter, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #334155; line-height: 1.6; }
  .card { max-width: 760px; margin: 40px auto; background: #fff; border-radius: 20px; box-shadow: 0 10px 40px rgba(15, 23, 42, .08); overflow: hidden; }
  .top { background: linear-gradient(135deg, #0d2847, #1e3a8a); color: #fff; padding: 28px 32px; }
  .top small { letter-spacing: 1.5px; font-weight: 700; color: #fdba74; }
  .top h1 { margin: 6px 0 0; font-size: 26px; }
  .content { padding: 28px 32px; }
  .terms { max-height: 340px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px 20px; background: #f8fafc; font-size: 14px; }
  .terms h3 { font-size: 15px; margin: 14px 0 4px; color: #0d2847; }
  button { background: #ea580c; color: #fff; border: 0; border-radius: 12px; padding: 14px 24px; font-size: 16px; font-weight: 700; cursor: pointer; }
  button:hover { background: #c2410c; }
  a { color: #ea580c; }
  .ok { color: #15803d; font-weight: 700; }
</style>
</head>
<body><div class="card">${body}</div></body>
</html>`;
}

module.exports = { escape, page };
