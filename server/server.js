require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { jwtSecretPolicy } = require('./utils/jwtConfig');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const missing = ['MONGO_URI', 'JWT_SECRET'].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}
const secretCheck = jwtSecretPolicy(process.env.JWT_SECRET);
if (secretCheck.action === 'exit') {
  console.error(`Refusing to start in production: ${secretCheck.reason}. Use a random secret of at least 32 characters.`);
  process.exit(1);
}
if (secretCheck.action === 'warn') {
  console.warn(`SECURITY WARNING: ${secretCheck.reason}. Set a random JWT_SECRET of at least 32 characters (this is fatal when NODE_ENV=production).`);
}
if (!process.env.GEMINI_API_KEY) {
  console.warn('GEMINI_API_KEY is not set: AI features will return 503.');
}

connectDB();
require('./models/Company');
const app = express();

const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());
// Only when running behind a reverse proxy: TRUST_PROXY=<number of proxy hops>. Left off by default so a client
// cannot spoof its address (which the auth rate limiter relies on) with X-Forwarded-For.
const trustProxy = Number(process.env.TRUST_PROXY);
if (Number.isInteger(trustProxy) && trustProxy > 0) app.set('trust proxy', trustProxy);

// This is a JSON API, so helmet's defaults apply; CORP is relaxed so the SPA on another origin can read responses.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: allowedOrigins }));
app.use('/api/auth', express.json({ limit: '10kb' }));
app.use(express.json({ limit: '1mb' }));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/jobs', require('./routes/jobRoutes'));
app.use('/api/saved-jobs', require('./routes/savedJobRoutes'));
app.use('/api/applications', require('./routes/applicationRoutes'));
app.use('/api/resume-analysis', require('./routes/resumeAnalysisRoutes'));
app.use('/api/resumes', require('./routes/resumeRoutes'));
app.use('/api/cover-letters', require('./routes/coverLetterRoutes'));
app.use('/api/referrals', require('./routes/referralRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/interviews', require('./routes/interviewRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/programs', require('./routes/programRoutes'));
app.use('/api/contact', require('./routes/contactRoutes'));

app.get('/', (req, res) => {
  res.send('AI Career Platform API is running');
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
