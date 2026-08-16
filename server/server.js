require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');

connectDB();

const app = express();
app.use(cors());
app.use(express.json());

const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

const jobRoutes = require('./routes/jobRoutes');
app.use('/api/jobs', jobRoutes);

const savedJobRoutes = require('./routes/savedJobRoutes');
app.use('/api/saved-jobs', savedJobRoutes);

const applicationRoutes = require('./routes/applicationRoutes');
app.use('/api/applications', applicationRoutes);

const resumeAnalysisRoutes = require('./routes/resumeAnalysisRoutes');
app.use('/api/resume-analysis', resumeAnalysisRoutes);

const resumeRoutes = require('./routes/resumeRoutes');
app.use('/api/resumes', resumeRoutes);

const coverLetterRoutes = require('./routes/coverLetterRoutes');
app.use('/api/cover-letters', coverLetterRoutes);

const referralRoutes = require('./routes/referralRoutes');
app.use('/api/referrals', referralRoutes);

app.get('/', (req, res) => {
  res.send('AI Career Platform API is running');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});