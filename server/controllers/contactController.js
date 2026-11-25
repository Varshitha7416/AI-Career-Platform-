const ContactMessage = require('../models/ContactMessage');
const User = require('../models/User');

const MAX_PER_HOUR = 5;

const createMessage = async (req, res, next) => {
  try {
    if (typeof req.body.subject !== 'string' || typeof req.body.message !== 'string') {
      return res.status(400).json({ message: 'Subject and message must be text' });
    }
    const subject = req.body.subject.trim();
    const message = req.body.message.trim();
    const errors = [];
    if (subject.length < 3 || subject.length > 120) errors.push('Subject must be 3-120 characters');
    if (message.length < 10 || message.length > 2000) errors.push('Message must be 10-2000 characters');
    if (errors.length) return res.status(400).json({ message: errors.join(', ') });

    const recent = await ContactMessage.countDocuments({ user: req.user.id, createdAt: { $gte: new Date(Date.now() - 3600000) } });
    if (recent >= MAX_PER_HOUR) {
      return res.status(429).json({ message: 'You have sent several messages recently. Please try again later.' });
    }

    // Name and email always come from the authenticated account, never from the request body.
    const user = await User.findById(req.user.id).select('name email');
    if (!user) return res.status(404).json({ message: 'User not found' });

    await ContactMessage.create({ user: user._id, name: user.name, email: user.email, subject, message });
    res.status(201).json({ message: 'Thanks! Your message has been sent.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { createMessage };
