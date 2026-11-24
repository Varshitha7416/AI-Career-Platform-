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
  
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);