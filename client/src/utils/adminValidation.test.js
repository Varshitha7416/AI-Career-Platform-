import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isHttpUrl, validateJobForm, validateCompanyForm } from './adminValidation.js';

const ok = { title: 'T', company: 'c1', city: 'Pune', jobDescription: 'd', applyUrl: 'https://x.example.com' };
const today = new Date(2026, 5, 10, 15, 0);

test('isHttpUrl only accepts http(s) or empty', () => {
  assert.equal(isHttpUrl(''), true);
  assert.equal(isHttpUrl('https://a.example.com/x'), true);
  assert.equal(isHttpUrl('javascript:alert(1)'), false);
  assert.equal(isHttpUrl('ftp://a.example.com'), false);
  assert.equal(isHttpUrl('nope'), false);
});

test('validateJobForm: required fields, ranges, deadline', () => {
  assert.deepEqual(validateJobForm(ok, { today }), {});
  const e = validateJobForm({ title: ' ', company: '', city: '', jobDescription: '' }, { today });
  assert.deepEqual(Object.keys(e).sort(), ['city', 'company', 'jobDescription', 'title']);
  assert.ok(validateJobForm({ ...ok, applyUrl: 'javascript:x' }, { today }).applyUrl);
  assert.ok(validateJobForm({ ...ok, experienceMinYears: '5', experienceMaxYears: '2' }, { today }).experienceMaxYears);
  assert.ok(validateJobForm({ ...ok, salaryMin: '20', salaryMax: '10' }, { today }).salaryMax);
  assert.ok(validateJobForm({ ...ok, applicationDeadline: '2026-06-01' }, { today }).applicationDeadline);
  assert.equal(validateJobForm({ ...ok, applicationDeadline: '2026-06-10' }, { today }).applicationDeadline, undefined);
  assert.equal(validateJobForm({ ...ok, applicationDeadline: '2026-06-01' }, { today, originalDeadline: '2026-06-01' }).applicationDeadline, undefined);
});

test('validateCompanyForm', () => {
  assert.deepEqual(validateCompanyForm({ name: 'Acme', website: 'https://a.example.com' }), {});
  assert.ok(validateCompanyForm({ name: 'A' }).name);
  assert.ok(validateCompanyForm({ name: 'Acme', logoUrl: 'file:///x' }).logoUrl);
});
