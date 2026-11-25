const mongoose = require('mongoose');

// Career-development program (curated DEMO content: provider names are real, `url` is the provider's public home page).
const programSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  provider: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  level: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'], default: 'Beginner' },
  duration: { type: String },
  skills: { type: [String], default: [] },
  url: { type: String },
  theme: { type: String, enum: ['forest', 'sage', 'mint', 'moss'], default: 'forest' },
  isActive: { type: Boolean, default: true },
  source: { type: String, enum: ['demo', 'manual', 'api'], default: 'demo' },
}, { timestamps: true });

programSchema.index({ category: 1 });
programSchema.index({ isActive: 1 });

module.exports = mongoose.model('Program', programSchema);
