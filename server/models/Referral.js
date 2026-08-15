const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  seeker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  referrer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  message: {
    type: String,
  },
  status: {
    type: String,
    enum: ['requested', 'accepted', 'declined', 'referred'],
    default: 'requested',
  },
}, { timestamps: true });

module.exports = mongoose.model('Referral', referralSchema);