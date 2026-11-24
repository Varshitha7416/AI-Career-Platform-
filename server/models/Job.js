const mongoose = require('mongoose');
const Counter = require('./Counter');
const { CURRENCIES, toAnnualInr } = require('../utils/salary');

const EMPLOYMENT_TYPES = ['full-time', 'part-time', 'contract', 'internship'];
const WORK_MODES = ['onsite', 'hybrid', 'remote'];
const SOURCES = ['demo', 'manual', 'api'];

const isHttpUrl = (v) => {
  if (v === undefined || v === null || v === '') return true;
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

const stringList = { type: [String], default: [] };

const jobSchema = new mongoose.Schema({
  // ---- original fields (unchanged, existing documents stay valid) ----
  title: { type: String, required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  city: { type: String, required: true },
  jobDescription: { type: String, required: true },
  experienceLevel: { type: String, enum: ['fresher', 'experienced'], required: true },
  yearsRequired: { type: Number, default: 0 },
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // ---- identity / provenance ----
  jobCode: { type: String, unique: true, sparse: true },           // e.g. CN-000123
  source: { type: String, enum: SOURCES, default: 'manual' },     // 'demo' = generated sample listing
  externalId: { type: String, unique: true, sparse: true },       // id in an external feed (future live-data API)
  isActive: { type: Boolean, default: true },
  postedAt: { type: Date, default: Date.now },

  // ---- job facts ----
  country: { type: String, default: 'India' },
  employmentType: { type: String, enum: EMPLOYMENT_TYPES, default: 'full-time' },
  workMode: { type: String, enum: WORK_MODES, default: 'onsite' },
  experienceMinYears: { type: Number, min: 0 },
  experienceMaxYears: { type: Number, min: 0 },

  // ---- salary (annual unless salaryPeriod says otherwise) ----
  salaryMin: { type: Number, min: 0 },
  salaryMax: { type: Number, min: 0 },
  salaryCurrency: { type: String, enum: CURRENCIES, default: 'INR' },
  salaryPeriod: { type: String, enum: ['year', 'month'], default: 'year' },
  salaryMaxInr: { type: Number, min: 0 },                         // derived: comparable annual INR value

  // ---- content ----
  skills: stringList,
  preferredSkills: stringList,
  responsibilities: stringList,
  requirements: stringList,
  education: stringList,

  // ---- application ----
  applyUrl: { type: String, validate: { validator: isHttpUrl, message: 'applyUrl must be a valid http(s) URL' } },
}, { timestamps: true });

jobSchema.index({ isActive: 1, postedAt: -1 });
jobSchema.index({ company: 1 });
jobSchema.index({ city: 1 });
jobSchema.index({ workMode: 1 });
jobSchema.index({ employmentType: 1 });
jobSchema.index({ experienceMinYears: 1, experienceMaxYears: 1 });
jobSchema.index({ skills: 1 });
jobSchema.index({ salaryMaxInr: -1 });

// Keep the old and new experience fields consistent, derive salary comparison value, assign a job ID.
jobSchema.pre('validate', async function () {
  if (this.experienceMinYears === undefined || this.experienceMinYears === null) {
    this.experienceMinYears = this.yearsRequired || 0;
  }
  if (this.experienceMaxYears === undefined || this.experienceMaxYears === null) {
    this.experienceMaxYears = Math.max(this.experienceMinYears, this.yearsRequired || 0) + (this.experienceMinYears === 0 ? 1 : 2);
  }
  if (!this.experienceLevel) {
    this.experienceLevel = this.experienceMinYears === 0 && this.experienceMaxYears <= 1 ? 'fresher' : 'experienced';
  }
  if (this.salaryMax !== undefined && this.salaryMax !== null) {
    this.salaryMaxInr = toAnnualInr(this.salaryMax, this.salaryCurrency, this.salaryPeriod) ?? undefined;
  }
  if (this.isNew && !this.jobCode) {
    const n = await Counter.next('jobCode');
    this.jobCode = `CN-${String(n).padStart(6, '0')}`;
  }
});

jobSchema.statics.EMPLOYMENT_TYPES = EMPLOYMENT_TYPES;
jobSchema.statics.WORK_MODES = WORK_MODES;
jobSchema.statics.SOURCES = SOURCES;

module.exports = mongoose.model('Job', jobSchema);
