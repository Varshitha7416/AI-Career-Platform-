const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Per-collection decision for ACCOUNT DELETION (documented in docs/26-account-management.md).
//   delete     rows owned by the user are removed (deleteMany on `field`)
//   anonymize  the row belongs to a relationship with ANOTHER user: the deleted side's content is removed, the other side keeps a usable record
//   retain     the row is shared/audit data that must outlive the user; it only points at the anonymized User document
//   email      rows keyed by the user's email address (development outbox only), removed BEFORE the email is replaced
// A test (tests/account) fails when any schema path with ref 'User' is missing here, so a new model cannot silently skip deletion.
const POLICY = {
  Application: { action: 'delete', field: 'user' },
  SavedJob: { action: 'delete', field: 'user' },
  Resume: { action: 'delete', field: 'user' },
  ResumeAnalysis: { action: 'delete', field: 'user' },
  CoverLetter: { action: 'delete', field: 'user' },
  SkillGapAnalysis: { action: 'delete', field: 'user' },
  LearningRoadmap: { action: 'delete', field: 'user' },
  Notification: { action: 'delete', field: 'user' },
  Interview: { action: 'delete', field: 'user' },
  ProgramEnrollment: { action: 'delete', field: 'user' },
  ContactMessage: { action: 'anonymize', fields: ['user'] }, // support history is kept; the user's identity and free text are removed (docs/28)
  AuthToken: { action: 'delete', field: 'user' },
  AuthRecoveryState: { action: 'delete', field: 'user' },
  Referral: { action: 'anonymize', fields: ['seeker', 'referrer', 'statusHistory.by'] },
  Job: { action: 'retain', fields: ['postedBy'] },
  AdminAuditLog: { action: 'retain', fields: ['actor'] },
  OutboxEmail: { action: 'email' },
  User: { action: 'anonymize' },
};

// Loads every model file so the registry is complete, then lists every schema path that references the User model.
const loadModels = () => {
  const dir = path.join(__dirname, '..', '..', 'models');
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.js')) {
      try { require(path.join(dir, f)); } catch { /* dev-only model proxies */ }
    }
  }
};

const findUserRefs = () => {
  loadModels();
  const out = [];
  const walk = (schema, model, prefix) => {
    schema.eachPath((p, type) => {
      const opts = type.options || {};
      const ref = opts.ref || (Array.isArray(opts.type) && opts.type[0] && opts.type[0].ref) || (type.caster && type.caster.options && type.caster.options.ref);
      if (ref === 'User') out.push({ model, path: prefix + p });
      if (type.schema) walk(type.schema, model, `${prefix}${p}.`);
    });
  };
  for (const name of mongoose.modelNames()) walk(mongoose.model(name).schema, name, '');
  return out;
};

const unmappedModels = () => [...new Set(findUserRefs().map((r) => r.model))].filter((m) => !POLICY[m]);

module.exports = { POLICY, loadModels, findUserRefs, unmappedModels };
