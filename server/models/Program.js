const mongoose = require('mongoose');
const { parseDurationWeeks } = require('../utils/programs/duration');

// Career-development program (curated DEMO content: provider names are real, `url` is the provider's public home page).
// Additive fields (no migration needed): durationWeeks (derived), milestones, enrollmentInfo, resources, archivedAt.
const programSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  provider: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  level: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'], default: 'Beginner' },
  duration: { type: String },
  durationWeeks: { type: Number }, // derived from `duration` when it contains a week/month/day figure
  skills: { type: [String], default: [] },
  url: { type: String },
  theme: { type: String, enum: ['forest', 'sage', 'mint', 'moss'], default: 'forest' },
  isActive: { type: Boolean, default: true },
  archivedAt: { type: Date }, // soft archive (admin); archived programs are also inactive
  source: { type: String, enum: ['demo', 'manual', 'api'], default: 'demo' },
  enrollmentInfo: { type: String, maxlength: 1000 },
  resources: { type: [new mongoose.Schema({ title: { type: String, required: true, maxlength: 120 }, url: { type: String, required: true, maxlength: 500 } }, { _id: false })], default: [] },
  milestones: { type: [new mongoose.Schema({ title: { type: String, required: true, maxlength: 120 }, order: { type: Number, required: true } }, { _id: false })], default: [] },
}, { timestamps: true });

programSchema.pre('validate', function derive() {
  if (this.isNew || this.isModified('duration')) this.durationWeeks = parseDurationWeeks(this.duration) ?? undefined;
});

programSchema.index({ category: 1 });
programSchema.index({ isActive: 1 });

module.exports = mongoose.model('Program', programSchema);
