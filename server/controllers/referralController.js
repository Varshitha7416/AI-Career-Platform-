const User = require('../models/User');
const Referral = require('../models/Referral');

const findReferrers = async (req, res) => {
  try {
    const { company } = req.query;

    const referrers = await User.find({
      isReferrer: true,
      currentCompany: { $regex: company, $options: 'i' },
    }).select('name currentCompany currentCompanyRole');

    res.status(200).json({ count: referrers.length, referrers });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const requestReferral = async (req, res) => {
  try {
    const { seekerId, referrerId, message } = req.body;

    const referral = await Referral.create({
      seeker: seekerId,
      referrer: referrerId,
      message,
    });

    res.status(201).json({ message: 'Referral requested', referral });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const updateReferralStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const updatedReferral = await Referral.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!updatedReferral) {
      return res.status(404).json({ message: 'Referral not found' });
    }

    res.status(200).json({ message: 'Referral status updated', referral: updatedReferral });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { findReferrers, requestReferral, updateReferralStatus };