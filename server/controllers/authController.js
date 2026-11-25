const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Resume = require('../models/Resume');
const { signToken } = require('../utils/jwtConfig');
const { validateName, validateEmail, validatePassword, EMAIL_MAX } = require('../utils/authValidation');
const { effectiveInterests, searchRoles, roleKey, cleanRole, ROLE_MAX } = require('../utils/roles');
const P = require('../utils/profileValidation');

const plain = (arr) => (Array.isArray(arr) ? arr.map((x) => (x && typeof x.toObject === 'function' ? x.toObject() : x)) : []);

const publicUser = (u) => {
  const { interests, primaryRole } = effectiveInterests(u);
  return {
    id: u._id,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt || null,
    seekingRole: u.seekingRole || '',
    isReferrer: !!u.isReferrer,
    currentCompany: u.currentCompany || '',
    currentCompanyRole: u.currentCompanyRole || '',
    referralCompanies: Array.isArray(u.referralCompanies) ? u.referralCompanies : [],
    preferredLocation: u.preferredLocation || '',
    preferredWorkMode: u.preferredWorkMode || '',
    preferredEmploymentType: u.preferredEmploymentType || '',
    experienceYears: u.experienceYears ?? null,
    notificationPrefs: {
      applications: u.notificationPrefs?.applications !== false,
      interviews: u.notificationPrefs?.interviews !== false,
      referrals: u.notificationPrefs?.referrals !== false,
    },
    phone: u.phone || '',
    location: u.location || '',
    headline: u.headline || '',
    bio: u.bio || '',
    linkedinUrl: u.linkedinUrl || '',
    githubUrl: u.githubUrl || '',
    portfolioUrl: u.portfolioUrl || '',
    experienceLevel: u.experienceLevel || '',
    education: plain(u.education),
    experiences: plain(u.experiences),
    skills: plain(u.skills),
    domains: Array.isArray(u.domains) ? [...u.domains] : [],
    // Derived from the legacy seekingRole when nothing is stored yet (no migration needed).
    careerInterests: interests,
    primaryRole,
  };
};

// Promote the configured admin email (if any) so admin access needs no manual DB edits.
const applyAdminEmail = async (user) => {
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (adminEmail && user.email === adminEmail && user.role !== 'admin') {
    user.role = 'admin';
    await user.save();
  }
};

const BCRYPT_ROUNDS = 12;
let dummyHashPromise;
// Compared against when the email is unknown so unknown-user and wrong-password logins take similar time.
const dummyHash = () => {
  if (!dummyHashPromise) dummyHashPromise = bcrypt.hash('not-a-real-password-for-timing-only', BCRYPT_ROUNDS);
  return dummyHashPromise;
};

const bodyOf = (req) => (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {});

const validationError = (res, errors, message = 'Please fix the highlighted fields') =>
  res.status(400).json({ message, code: 'VALIDATION_ERROR', errors });

const signup = async (req, res, next) => {
  try {
    // Only these fields are ever read from the body: role, tokenVersion, _id etc. can never be set by a client.
    const { name: rawName, email: rawEmail, password: rawPassword, acceptTerms } = bodyOf(req);

    const errors = {};
    const name = validateName(rawName);
    if (name.error) errors.name = name.error;
    const email = validateEmail(rawEmail);
    if (email.error) errors.email = email.error;
    const password = validatePassword(rawPassword, { email: email.value || '', name: name.value || '' });
    if (password.error) errors.password = password.error;
    if (Object.keys(errors).length) return validationError(res, errors);

    const emailTaken = { message: 'An account with this email already exists', code: 'EMAIL_EXISTS' };
    if (await User.findOne({ email: email.value })) return res.status(409).json(emailTaken);

    const hashedPassword = await bcrypt.hash(password.value, BCRYPT_ROUNDS);
    const doc = { name: name.value, email: email.value, password: hashedPassword };
    if (acceptTerms === true) doc.termsAcceptedAt = new Date();

    let newUser;
    try {
      newUser = await User.create(doc);
    } catch (err) {
      if (err && err.code === 11000) return res.status(409).json(emailTaken); // lost a race with a concurrent signup
      throw err;
    }
    await applyAdminEmail(newUser);

    res.status(201).json({ message: 'Account created successfully', userId: newUser._id });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email: rawEmail, password } = bodyOf(req);

    // Strings only: objects such as {"$gt": ""} are rejected before they can reach a query.
    if (typeof rawEmail !== 'string' || typeof password !== 'string' || !rawEmail.trim() || !password) {
      return res.status(400).json({ message: 'Email and password are required', code: 'VALIDATION_ERROR' });
    }
    const email = rawEmail.trim().toLowerCase();

    const user = email.length <= EMAIL_MAX ? await User.findOne({ email }) : null;
    const hash = user ? user.password : await dummyHash();
    const isMatch = await bcrypt.compare(password, hash);
    if (!user || !isMatch) {
      return res.status(401).json({ message: 'Invalid email or password', code: 'INVALID_CREDENTIALS' });
    }

    await applyAdminEmail(user);

    res.status(200).json({ message: 'Login successful', token: signToken(user), user: publicUser(user) });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    const { interests } = effectiveInterests(user);
    const keys = new Set(interests.map((i) => i.roleKey));
    const keyed = await Resume.find({ user: req.user.id }).select('targetRoleKey').lean();
    const roleResumeCount = keyed.filter((r) => r.targetRoleKey && keys.has(r.targetRoleKey)).length;
    const resumeSummary = {
      count: keyed.length,
      roleResumeCount,
      resumeReady: keyed.length > 0,
      unassignedCount: keyed.length - roleResumeCount,
    };
    res.status(200).json({ user: { ...publicUser(user), resumeSummary } });
  } catch (error) {
    next(error);
  }
};

const getRoles = (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.slice(0, ROLE_MAX) : '';
  res.status(200).json({ roles: searchRoles(q, 15) });
};

// 400 with the same {message, code, errors:{field}} shape as signup.
const fieldError = (res, field, message, code = 'VALIDATION_ERROR') => res.status(400).json({ message, code, errors: { [field]: message } });

const updateProfile = async (req, res, next) => {
  try {
    // Whitelisted fields only (role, email, tokenVersion, _id... are never read from the body). Partial update:
    // only keys present in the body are validated and changed.
    const body = bodyOf(req);
    const { name, seekingRole, isReferrer, currentCompany, currentCompanyRole, currentPassword, newPassword } = body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name !== undefined) {
      const n = validateName(name);
      if (n.error) return validationError(res, { name: n.error }, n.error);
      user.name = n.value;
    }
    for (const [key, value] of [['currentCompany', currentCompany], ['currentCompanyRole', currentCompanyRole]]) {
      if (value === undefined) continue;
      if (typeof value !== 'string') return fieldError(res, key, `${key} must be text`);
      if (value.trim().length > 100) return fieldError(res, key, `${key} must be 100 characters or fewer`);
      user[key] = value.trim();
    }
    if (isReferrer !== undefined) {
      if (typeof isReferrer !== 'boolean') return fieldError(res, 'isReferrer', 'isReferrer must be true or false');
      user.isReferrer = isReferrer;
    }

    // ---- extended profile fields ('' clears a text value)
    const simple = [
      ['phone', () => P.validatePhone(body.phone)],
      ['location', () => P.text(body.location, 'Location', 100)],
      ['headline', () => P.text(body.headline, 'Headline', 120)],
      ['bio', () => P.text(body.bio, 'About you', 600, { multiline: true })],
      ['linkedinUrl', () => P.validateUrl(body.linkedinUrl, 'LinkedIn link')],
      ['githubUrl', () => P.validateUrl(body.githubUrl, 'GitHub link')],
      ['portfolioUrl', () => P.validateUrl(body.portfolioUrl, 'Portfolio link')],
    ];
    for (const [key, run] of simple) {
      if (body[key] === undefined) continue;
      const result = run();
      if (result.error) return fieldError(res, key, result.error);
      user[key] = result.value || undefined;
    }
    if (body.experienceLevel !== undefined) {
      const r = P.validateExperienceLevel(body.experienceLevel);
      if (r.error) return fieldError(res, 'experienceLevel', r.error);
      user.experienceLevel = r.value;
    }
    for (const [key, fn] of [['education', P.validateEducation], ['experiences', P.validateExperiences], ['skills', P.validateSkills], ['domains', P.validateDomains]]) {
      if (body[key] === undefined) continue;
      const r = fn(body[key]);
      if (r.error) return fieldError(res, key, r.error);
      user[key] = r.value;
    }

    // ---- career interests (<=3) + primary role; seekingRole is kept equal to the primary role
    const before = effectiveInterests(user);
    const hadStored = Array.isArray(user.careerInterests) && user.careerInterests.length > 0;
    let interests = before.interests;
    let primaryKey = before.primaryKey;
    let interestsTouched = false;
    let legacyRoleIgnored = false;
    if (body.careerInterests !== undefined) {
      const r = P.validateInterests(body.careerInterests);
      if (r.error) return fieldError(res, 'careerInterests', r.error, r.code);
      interests = r.value;
      if (!interests.some((i) => i.roleKey === primaryKey)) primaryKey = interests[0] ? interests[0].roleKey : '';
      interestsTouched = true;
    } else if (seekingRole !== undefined) {
      interestsTouched = true;
      // Legacy single-role field: an existing interest becomes primary, a new one is added (or replaces the single
      // derived legacy role). Empty removes the primary interest.
      if (typeof seekingRole !== 'string') return fieldError(res, 'seekingRole', 'seekingRole must be text');
      const role = cleanRole(seekingRole);
      if (role.length > ROLE_MAX) return fieldError(res, 'seekingRole', `Role must be ${ROLE_MAX} characters or fewer`);
      const key = roleKey(role);
      if (!role) {
        interests = interests.filter((i) => i.roleKey !== primaryKey);
        primaryKey = interests[0] ? interests[0].roleKey : '';
      } else if (interests.some((i) => i.roleKey === key)) {
        primaryKey = key;
      } else if (!hadStored) {
        interests = [{ role, roleKey: key }];
        primaryKey = key;
      } else if (interests.length >= 3) {
        // Legacy single-role write against a full three-role profile: never invalidate the profile or replace the
        // primary role behind the user's back. Interests stay as they are and the response says so.
        legacyRoleIgnored = true;
        interestsTouched = false;
      } else {
        interests = [...interests, { role, roleKey: key }];
        primaryKey = key;
      }
    }
    if (body.primaryRole !== undefined) {
      if (typeof body.primaryRole !== 'string') return fieldError(res, 'primaryRole', 'primaryRole must be text');
      const k = roleKey(body.primaryRole);
      if (k) {
        if (!interests.some((i) => i.roleKey === k)) return fieldError(res, 'primaryRole', 'Your primary role must be one of your career interests', 'INVALID_PRIMARY_ROLE');
        primaryKey = k;
      }
      interestsTouched = true;
    }
    if (interestsTouched) {
      const primary = interests.find((i) => i.roleKey === primaryKey) || interests[0] || null;
      user.careerInterests = interests;
      user.primaryRole = primary ? primary.role : undefined;
      user.seekingRole = primary ? primary.role : '';
    }

    // Optional job preferences (used for recommendations); empty string clears a value.
    const { preferredLocation, preferredWorkMode, preferredEmploymentType, experienceYears } = body;
    if (preferredLocation !== undefined && typeof preferredLocation !== 'string') {
      return fieldError(res, 'preferredLocation', 'preferredLocation must be text');
    }
    if (preferredLocation !== undefined) user.preferredLocation = preferredLocation.trim().slice(0, 100);
    if (preferredWorkMode !== undefined) {
      if (preferredWorkMode !== '' && !['onsite', 'hybrid', 'remote'].includes(preferredWorkMode)) {
        return fieldError(res, 'preferredWorkMode', 'Preferred work mode must be onsite, hybrid or remote');
      }
      user.preferredWorkMode = preferredWorkMode;
    }
    if (preferredEmploymentType !== undefined) {
      if (preferredEmploymentType !== '' && !['full-time', 'part-time', 'contract', 'internship'].includes(preferredEmploymentType)) {
        return fieldError(res, 'preferredEmploymentType', 'Preferred employment type is not valid');
      }
      user.preferredEmploymentType = preferredEmploymentType;
    }
    if (experienceYears !== undefined) {
      if (experienceYears === '' || experienceYears === null) {
        user.experienceYears = undefined;
      } else {
        const y = Number(experienceYears);
        if (typeof experienceYears === 'boolean' || !Number.isFinite(y) || y < 0 || y > 50) return fieldError(res, 'experienceYears', 'Experience must be between 0 and 50 years');
        user.experienceYears = y;
      }
    }

    // In-app notification preferences (booleans only; omitted keys are left unchanged)
    if (body.notificationPrefs !== undefined) {
      const prefs = body.notificationPrefs;
      if (prefs === null || typeof prefs !== 'object' || Array.isArray(prefs)) {
        return fieldError(res, 'notificationPrefs', 'notificationPrefs must be an object');
      }
      for (const key of ['applications', 'interviews', 'referrals']) {
        if (prefs[key] === undefined) continue;
        if (typeof prefs[key] !== 'boolean') return fieldError(res, 'notificationPrefs', `notificationPrefs.${key} must be true or false`);
        user.set(`notificationPrefs.${key}`, prefs[key]);
      }
    }

    // Companies the user can give referrals for (self-reported): <=10, each trimmed <=80, deduped (case-insensitive)
    if (body.referralCompanies !== undefined) {
      const raw = body.referralCompanies;
      if (!Array.isArray(raw)) return fieldError(res, 'referralCompanies', 'referralCompanies must be a list of company names');
      const seen = new Set();
      const cleaned = [];
      for (const item of raw) {
        if (typeof item !== 'string') return fieldError(res, 'referralCompanies', 'Each company name must be text');
        const c = item.trim();
        if (!c) continue;
        if (c.length > 80) return fieldError(res, 'referralCompanies', 'Each company name must be 80 characters or fewer');
        if (seen.has(c.toLowerCase())) continue;
        seen.add(c.toLowerCase());
        cleaned.push(c);
      }
      if (cleaned.length > 10) return fieldError(res, 'referralCompanies', 'You can list at most 10 companies');
      user.referralCompanies = cleaned;
    }

    if (user.isReferrer && !user.currentCompany && !(user.referralCompanies && user.referralCompanies.length)) {
      return fieldError(res, 'currentCompany', 'Add your company (or at least one referral company) to register as a referrer');
    }

    let newToken;
    if (newPassword !== undefined && newPassword !== '') {
      if (typeof newPassword !== 'string') return validationError(res, { newPassword: 'New password must be text' });
      const policy = validatePassword(newPassword, { email: user.email, name: user.name });
      if (policy.error) return validationError(res, { newPassword: policy.error }, policy.error);
      const ok = typeof currentPassword === 'string' && currentPassword !== '' && await bcrypt.compare(currentPassword, user.password);
      if (!ok) {
        return res.status(400).json({
          message: 'Current password is incorrect',
          code: 'INVALID_CURRENT_PASSWORD',
          errors: { currentPassword: 'Current password is incorrect' },
        });
      }
      if (newPassword === currentPassword) {
        const msg = 'New password must be different from your current password';
        return validationError(res, { newPassword: msg }, msg);
      }
      user.password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
      user.tokenVersion = (user.tokenVersion || 0) + 1; // retires every older token
      newToken = signToken(user);
    }

    await user.save();

    // A role that is no longer an interest can no longer be a resume's target: un-assign (never delete) those resumes.
    let resumesUnassigned = 0;
    if (interestsTouched) {
      const keep = interests.map((i) => i.roleKey);
      const r = await Resume.updateMany(
        { user: user._id, targetRoleKey: { $nin: [null, ...keep] } },
        { $set: { targetRole: null, targetRoleKey: null } },
      );
      resumesUnassigned = r.modifiedCount || 0;
    }
    res.status(200).json({
      message: 'Profile updated',
      user: publicUser(user),
      ...(resumesUnassigned ? { resumesUnassigned } : {}),
      ...(legacyRoleIgnored ? { notice: 'You already have 3 career interests, so the new role was not added. Use career interests to change them.' } : {}),
      ...(newToken ? { token: newToken } : {}),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { signup, login, getMe, getRoles, updateProfile };
