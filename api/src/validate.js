const { disclaimer, options } = require('./shared');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ACCOUNT_TYPES = new Set(options.accountTypes.map((o) => o.value));
const INTERESTS = new Set(options.interests.map((o) => o.value));
const AVAILABILITY = new Set(options.availability.map((o) => o.value));

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const digits = (v) => str(v).replace(/[^\d+]/g, '');

function phone(value, label, required, errors) {
  const raw = str(value);
  if (!raw) {
    if (required) errors[label] = 'Phone number is required.';
    return null;
  }
  const d = digits(raw).replace(/^\+/, '');
  if (d.length < 10 || d.length > 15) {
    errors[label] = 'Enter a valid phone number.';
    return null;
  }
  return raw.slice(0, 20);
}

function list(value, allowed) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((v) => typeof v === 'string' && allowed.has(v)))];
}

function validateRegistration(body) {
  const b = body && typeof body === 'object' ? body : {};
  const errors = {};

  const accountType = str(b.accountType);
  if (!ACCOUNT_TYPES.has(accountType)) errors.accountType = 'Choose an account type.';
  const isStudent = accountType === 'student';

  const firstName = str(b.firstName);
  const middleName = str(b.middleName);
  const lastName = str(b.lastName);
  if (!firstName) errors.firstName = 'First name is required.';
  else if (firstName.length > 80) errors.firstName = 'First name is too long.';
  if (middleName.length > 80) errors.middleName = 'Middle name is too long.';
  if (!lastName) errors.lastName = 'Last name is required.';
  else if (lastName.length > 80) errors.lastName = 'Last name is too long.';

  const email = str(b.email).toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) errors.email = 'Enter a valid email address.';

  const phoneValue = phone(b.phone, 'phone', !isStudent, errors);

  let parentEmail = null;
  let parentPhone = null;
  if (isStudent) {
    parentEmail = str(b.parentEmail).toLowerCase();
    if (!EMAIL_RE.test(parentEmail) || parentEmail.length > 254) {
      errors.parentEmail = 'Enter a valid parent / guardian email.';
    } else if (parentEmail === email) {
      errors.parentEmail = 'Parent / guardian email must be different from the student email.';
    }
    parentPhone = phone(b.parentPhone, 'parentPhone', true, errors);
  }

  const notes = str(b.notes);
  if (notes.length > 1000) errors.notes = 'Notes must be 1000 characters or fewer.';

  if (b.disclaimerAccepted !== true) errors.disclaimerAccepted = 'You must agree to the disclaimer and waiver.';
  if (b.disclaimerVersion !== disclaimer.version) {
    errors.disclaimerVersion = 'The disclaimer has been updated. Please reload the page and review it again.';
  }

  return {
    errors,
    value: {
      accountType,
      firstName,
      middleName: middleName || null,
      lastName,
      email,
      phone: phoneValue,
      parentEmail,
      parentPhone,
      interests: list(b.interests, INTERESTS),
      availability: list(b.availability, AVAILABILITY),
      notes: notes || null,
    },
  };
}

module.exports = { validateRegistration };
