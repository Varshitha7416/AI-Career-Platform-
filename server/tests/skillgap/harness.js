// Minimal test server (child process): mounts only what the Skill Gap API tests need (both /skill-gap routers), so the tests do not depend on
// server.js. Requires explicit MONGO_URI (local disposable mongod), JWT_SECRET, PORT. Never reads .env.
const express = require('express');
const mongoose = require('mongoose');
const { notFound, errorHandler } = require('../../middleware/errorHandler');

if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(process.env.MONGO_URI || '')) {
  console.error('harness refuses a non-local MONGO_URI');
  process.exit(1);
}
require('../../models/Company');
const app = express();
app.use('/api/auth', express.json({ limit: '10kb' }));
app.use(express.json({ limit: '1mb' }));
app.use('/api/auth', require('../../routes/authRoutes'));
app.use('/api/resumes', require('../../routes/resumeRoutes'));
app.use('/api/skill-gap', require('../../routes/roadmapRoutes')); // same order as server.js: fixed paths first
app.use('/api/skill-gap', require('../../routes/skillGapRoutes'));
app.use(notFound);
app.use(errorHandler);

mongoose.connect(process.env.MONGO_URI).then(() => {
  app.listen(Number(process.env.PORT), () => console.log('Server running'));
});
