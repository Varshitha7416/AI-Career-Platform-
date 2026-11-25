const mongoose = require('mongoose');
const { resolveAutoIndex, connectOptions } = require('./dbOptions');

const connectDB = async () => {
  try {
    const { autoIndex, reason } = resolveAutoIndex(process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI, connectOptions(process.env.MONGO_URI));
    console.log('MongoDB connected successfully');
    console.log(autoIndex
      ? `Index auto-creation: ON (${reason})`
      : `Index auto-creation: OFF (${reason}). Indexes are managed deliberately with "npm run indexes".`);
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
