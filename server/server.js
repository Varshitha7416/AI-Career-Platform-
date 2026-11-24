require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const missing = ['MONGO_URI', 'JWT_SECRET'].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
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
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '1mb' }));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/jobs', require('./routes/jobRoutes'));
app.use('/api/saved-jobs', require('./routes/savedJobRoutes'));
app.use('/api/applications', require('./routes/applicationRoutes'));
app.use('/api/resume-analysis', require('./routes/resumeAnalysisRoutes'));
app.use('/api/resumes', require('./routes/resumeRoutes'));
app.use('/api/cover-letters', require('./routes/coverLetterRoutes'));
app.use('/api/referrals', require('./routes/referralRoutes'));

app.get('/', (req, res) => {
  res.send('AI Career Platform API is running');
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
