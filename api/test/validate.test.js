const test = require('node:test');
const assert = require('node:assert/strict');
const { validateRegistration } = require('../src/validate');
const { disclaimer } = require('../src/shared');

const base = {
  firstName: 'Anu',
  lastName: 'Reddy',
  email: 'Anu@Example.com',
  disclaimerAccepted: true,
  disclaimerVersion: disclaimer.version,
};

test('student requires parent email and phone', () => {
  const { errors } = validateRegistration({ ...base, accountType: 'student' });
  assert.ok(errors.parentEmail);
  assert.ok(errors.parentPhone);
  assert.equal(errors.phone, undefined);
});

test('adult requires own phone and ignores parent fields', () => {
  const { errors, value } = validateRegistration({ ...base, accountType: 'volunteer', parentEmail: 'x@y.com' });
  assert.ok(errors.phone);
  assert.equal(value.parentEmail, null);
});

test('valid student is normalized', () => {
  const { errors, value } = validateRegistration({
    ...base,
    accountType: 'student',
    parentEmail: 'mom@example.com',
    parentPhone: '(813) 555-9876',
    interests: ['food', 'food', 'nope'],
  });
  assert.deepEqual(errors, {});
  assert.equal(value.email, 'anu@example.com');
  assert.deepEqual(value.interests, ['food']);
});

test('disclaimer must be accepted at the current version', () => {
  const { errors } = validateRegistration({ ...base, accountType: 'parent', phone: '8135551234', disclaimerAccepted: false, disclaimerVersion: 'old' });
  assert.ok(errors.disclaimerAccepted);
  assert.ok(errors.disclaimerVersion);
});

test('parent email must differ from student email', () => {
  const { errors } = validateRegistration({ ...base, accountType: 'student', parentEmail: 'anu@example.com', parentPhone: '8135559876' });
  assert.ok(errors.parentEmail);
});
