const User = require('../models/User');
const Referral = require('../models/Referral');
const { isValidId, escapeRegex } = require('../middleware/validate');

const DEFAULT_MESSAGE = "Hi, I'd love a referral at your company.";

const findReferrers = async (req, res, next) => {
  try {
    const company = String(req.query.company || '').trim();
    if (!company) {
      return res.status(400).json({ message: 'Company name is required' });
    }

    const referrers = await User.find({
      isReferrer: true,
      _id: { $ne: req.user.id },
      currentCompany: { $regex: escapeRegex(company), $options: 'i' },
    }).select('name currentCompany currentCompanyRole');

    res.status(200).json({ count: referrers.length, referrers });
  } catch (error) {
    next(error);
  }
};

const requestReferral = async (req, res, next) => {
  try {
    const { referrerId } = req.body;
    const message = String(req.body.message || '').trim() || DEFAULT_MESSAGE;

    if (!isValidId(String(referrerId))) {
      return res.status(400).json({ message: 'Invalid referrer' });
    }
    if (message.length > 1000) {
      return res.status(400).json({ message: 'Message must be 1000 characters or fewer' });
    }
    if (referrerId === req.user.id) {
      return res.status(400).json({ message: 'You cannot request a referral from yourself' });
    }

    const referrer = await User.findOne({ _id: referrerId, isReferrer: true });
    if (!referrer) {
      return res.status(404).json({ message: 'Referrer not found' });
    }

    const pending = await Referral.findOne({ seeker: req.user.id, referrer: referrerId, status: 'requested' });
    if (pending) {
      return res.status(400).json({ message: 'You already have a pending request with this referrer' });
    }

    const referral = await Referral.create({ seeker: req.user.id, referrer: referrerId, message });
    res.status(201).json({ message: 'Referral requested', referral });
  } catch (error) {
    next(error);
  }
};

const getMyRequests = async (req, res, next) => {
  try {
    const referrals = await Referral.find({ seeker: req.user.id })
      .sort({ createdAt: -1 })
      .populate('referrer', 'name currentCompany currentCompanyRole');
    res.status(200).json({ count: referrals.length, referrals });
  } catch (error) {
    next(error);
  }
};

const getIncomingRequests = async (req, res, next) => {
  try {
    const referrals = await Referral.find({ referrer: req.user.id })
      .sort({ createdAt: -1 })
      .populate('seeker', 'name email seekingRole');
    res.status(200).json({ count: referrals.length, referrals });
  } catch (error) {
    next(error);
  }
};

const ALLOWED_UPDATES = ['accepted', 'declined', 'referred'];

const updateReferralStatus = async (req, res, next) => {
  try {
    const status = String(req.body.status || '').toLowerCase();
    if (!ALLOWED_UPDATES.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${ALLOWED_UPDATES.join(', ')}` });
    }

    // Only the referrer named on the request may change its status.
    const updated = await Referral.findOneAndUpdate(
      { _id: req.params.id, referrer: req.user.id },
      { status },
      { returnDocument: 'after', runValidators: true }
    ).populate('seeker', 'name email seekingRole');

    if (!updated) {
      return res.status(404).json({ message: 'Referral not found' });
    }

    res.status(200).json({ message: 'Referral status updated', referral: updated });
  } catch (error) {
    next(error);
  }
};

module.exports = { findReferrers, requestReferral, getMyRequests, getIncomingRequests, updateReferralStatus };
