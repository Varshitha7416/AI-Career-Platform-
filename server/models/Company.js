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
}, { timestamps: true });

module.exports = mongoose.model('Company', companySchema);