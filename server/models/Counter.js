const mongoose = require('mongoose');

// Atomic sequence counters (used for human-friendly job IDs such as CN-000123).
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

counterSchema.statics.next = async function (name, by = 1) {
  const doc = await this.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: by } },
    { upsert: true, returnDocument: 'after' }
  );
  return doc.seq; // last value of the reserved block
};

module.exports = mongoose.model('Counter', counterSchema);
