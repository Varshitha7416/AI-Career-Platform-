const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 80,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: 254,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['jobseeker', 'admin'],
    default: 'jobseeker',
  },
  // Bumped on password change; JWTs carry the version they were issued with (missing = 0) so older ones stop working
  tokenVersion: {
    type: Number,
    default: 0,
  },
  // Set when the user ticked the terms box at signup (optional; not required by the API)
  termsAcceptedAt: {
    type: Date,
  },
  seekingRole: {
    type: String,
  },
  isReferrer: {
    type: Boolean,
    default: false,
  },
  currentCompany: {
    type: String,
  },
  // Self-reported companies the user can give referrals for (<=10, trimmed, deduped)
  referralCompanies: {
    type: [String],
    default: [],
  },
  currentCompanyRole: {
    type: String,
  },
  // Optional job preferences used for recommendations
  preferredLocation: {
    type: String,
  },
  preferredWorkMode: {
    type: String,
  },
  preferredEmploymentType: {
    type: String,
  },
  experienceYears: {
    type: Number,
    min: 0,
  },
  // In-app notification preferences (all on by default)
  notificationPrefs: {
    applications: { type: Boolean, default: true },
    interviews: { type: Boolean, default: true },
    referrals: { type: Boolean, default: true },
  },
  // ---- Profile (all optional, additive; legacy users simply lack them) ----
  phone: { type: String, maxlength: 20 },
  location: { type: String, maxlength: 100 },
  headline: { type: String, maxlength: 120 },
  bio: { type: String, maxlength: 600 },
  linkedinUrl: { type: String, maxlength: 300 },
  githubUrl: { type: String, maxlength: 300 },
  portfolioUrl: { type: String, maxlength: 300 },
  experienceLevel: { type: String, enum: ['fresher', 'experienced'] },
  education: {
    type: [new mongoose.Schema({
      institution: { type: String, maxlength: 120 },
      degree: { type: String, maxlength: 100 },
      fieldOfStudy: { type: String, maxlength: 100 },
      startYear: Number,
      endYear: Number,
      grade: { type: String, maxlength: 30 },
    }, { _id: false })],
    default: undefined,
  },
  experiences: {
    type: [new mongoose.Schema({
      company: { type: String, maxlength: 100 },
      title: { type: String, maxlength: 100 },
      startDate: String,
      endDate: String,
      current: Boolean,
      description: { type: String, maxlength: 1000 },
    }, { _id: false })],
    default: undefined,
  },
  skills: {
    type: [new mongoose.Schema({
      name: { type: String, maxlength: 40 },
      level: { type: String, enum: ['beginner', 'intermediate', 'advanced', 'expert'] },
    }, { _id: false })],
    default: undefined,
  },
  domains: { type: [String], default: undefined },
  // At most 3, unique by roleKey. Empty/missing for legacy users: the API derives one interest from seekingRole.
  careerInterests: {
    type: [new mongoose.Schema({ role: { type: String, maxlength: 80 }, roleKey: { type: String, maxlength: 80 } }, { _id: false })],
    default: undefined,
  },
  primaryRole: { type: String, maxlength: 80 },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);