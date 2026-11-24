const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  company: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Company',
  required: true,
  },
  city: {
    type: String,
    required: true,
  },
  jobDescription: {
    type: String,
    required: true,
  },
  experienceLevel: {
    type: String,
    enum: ['fresher', 'experienced'],
    required: true,
  },
  yearsRequired: {
    type: Number,
    default: 0,
  },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, { timestamps: true });

module.exports = mongoose.model('Job', jobSchema);