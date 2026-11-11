const nodemailer = require('nodemailer');
const config = require('./config');

const enabled = Boolean(config.smtp.host);

const transport = enabled
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    })
  : null;

async function send(message) {
  if (!transport) {
    console.info(`Email disabled (SMTP_HOST not set); skipped "${message.subject}" to ${message.to}`);
    return false;
  }
  try {
    await transport.sendMail({ from: config.smtp.from, ...message });
    return true;
  } catch (err) {
    console.error(`Failed to send "${message.subject}" to ${message.to}:`, err.message);
    return false;
  }
}

module.exports = { send, enabled };
