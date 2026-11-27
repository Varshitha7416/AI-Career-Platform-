const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  industry: {
    type: String,
  },
  location: {
    type: String,
  },
  description: {
    type: String,
  },
  website: {
    type: String,
  },
  logoUrl: {
    type: String,
  },
  size: {
    type: String,
  },
  // Archive instead of delete: archived companies cannot be chosen for new jobs; their existing jobs still populate.
  isActive: { type: Boolean, default: true },
  archivedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Company', companySchema);