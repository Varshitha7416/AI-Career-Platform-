const mongoose = require('mongoose');
const { resolveAutoIndex, connectOptions } = require('./dbOptions');

const connectDB = async () => {
  try {
    const { autoIndex, reason } = resolveAutoIndex(process.env.MONGO_URI);
    // Connection-state visibility (no URI, no credentials): a transient loss shows up in the log instead of being silent.
    mongoose.connection.on('disconnected', () => console.warn(`MongoDB disconnected (${new Date().toISOString()})`));
    mongoose.connection.on('reconnected', () => console.warn(`MongoDB reconnected (${new Date().toISOString()})`));
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
