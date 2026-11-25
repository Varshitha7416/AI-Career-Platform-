const mongoose = require('mongoose');

const contactMessageSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  subject: { type: String, required: true, minlength: 3, maxlength: 120 },
  message: { type: String, required: true, minlength: 10, maxlength: 2000 },
}, { timestamps: true });

module.exports = mongoose.model('ContactMessage', contactMessageSchema);
