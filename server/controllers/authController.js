const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { isEmail } = require('../middleware/validate');

const publicUser = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  seekingRole: u.seekingRole || '',
  isReferrer: !!u.isReferrer,
  currentCompany: u.currentCompany || '',
  currentCompanyRole: u.currentCompanyRole || '',
  preferredLocation: u.preferredLocation || '',
  preferredWorkMode: u.preferredWorkMode || '',
  preferredEmploymentType: u.preferredEmploymentType || '',
  experienceYears: u.experienceYears ?? null,
});

// Promote the configured admin email (if any) so admin access needs no manual DB edits.
const applyAdminEmail = async (user) => {
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (adminEmail && user.email === adminEmail && user.role !== 'admin') {
    user.role = 'admin';
    await user.save();
  }
};

const signup = async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (name.length < 2) return res.status(400).json({ message: 'Name must be at least 2 characters' });
    if (!isEmail(email)) return res.status(400).json({ message: 'Please enter a valid email address' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({ name, email, password: hashedPassword });
    await applyAdminEmail(newUser);

    res.status(201).json({ message: 'Account created successfully', userId: newUser._id });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    const isMatch = user ? await bcrypt.compare(password, user.password) : false;
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    await applyAdminEmail(user);

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({ message: 'Login successful', token, user: publicUser(user) });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { name, seekingRole, isReferrer, currentCompany, currentCompanyRole, currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (trimmed.length < 2) return res.status(400).json({ message: 'Name must be at least 2 characters' });
      user.name = trimmed;
    }
    if (seekingRole !== undefined) user.seekingRole = String(seekingRole).trim();
    if (currentCompany !== undefined) user.currentCompany = String(currentCompany).trim();
    if (currentCompanyRole !== undefined) user.currentCompanyRole = String(currentCompanyRole).trim();
    if (isReferrer !== undefined) user.isReferrer = Boolean(isReferrer);

    // Optional job preferences (used for recommendations); empty string clears a value.
    const { preferredLocation, preferredWorkMode, preferredEmploymentType, experienceYears } = req.body;
    if (preferredLocation !== undefined) user.preferredLocation = String(preferredLocation).trim().slice(0, 100);
    if (preferredWorkMode !== undefined) {
      if (preferredWorkMode !== '' && !['onsite', 'hybrid', 'remote'].includes(preferredWorkMode)) {
        return res.status(400).json({ message: 'Preferred work mode must be onsite, hybrid or remote' });
      }
      user.preferredWorkMode = preferredWorkMode;
    }
    if (preferredEmploymentType !== undefined) {
      if (preferredEmploymentType !== '' && !['full-time', 'part-time', 'contract', 'internship'].includes(preferredEmploymentType)) {
        return res.status(400).json({ message: 'Preferred employment type is not valid' });
      }
      user.preferredEmploymentType = preferredEmploymentType;
    }
    if (experienceYears !== undefined) {
      if (experienceYears === '' || experienceYears === null) {
        user.experienceYears = undefined;
      } else {
        const y = Number(experienceYears);
        if (!Number.isFinite(y) || y < 0 || y > 50) return res.status(400).json({ message: 'Experience must be between 0 and 50 years' });
        user.experienceYears = y;
      }
    }

    if (user.isReferrer && !user.currentCompany) {
      return res.status(400).json({ message: 'Company is required to register as a referrer' });
    }

    if (newPassword !== undefined && newPassword !== '') {
      if (String(newPassword).length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters' });
      }
      const ok = await bcrypt.compare(String(currentPassword || ''), user.password);
      if (!ok) return res.status(400).json({ message: 'Current password is incorrect' });
      user.password = await bcrypt.hash(String(newPassword), 10);
    }

    await user.save();
    res.status(200).json({ message: 'Profile updated', user: publicUser(user) });
  } catch (error) {
    next(error);
  }
};

module.exports = { signup, login, getMe, updateProfile };
