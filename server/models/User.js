const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    default: 'jobseeker',
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
  
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);