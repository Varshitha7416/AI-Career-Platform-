const multer = require('multer');

const notFound = (req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'File is too large. Maximum size is 5MB.'
      : `Upload error: ${err.message}`;
    return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ message });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: Object.values(err.errors).map((e) => e.message).join(', ') });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ message: `Invalid ${err.path}` });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Invalid JSON body' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request body is too large' });
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: 'Duplicate entry' });
  }
  // Errors that carry an explicit HTTP status (our own `err.status = ...` and body-parser/http-errors client errors).
  // Library errors flagged expose:false (and anything unrecognised) never leak their message.
  if (Number.isInteger(err.status) && err.status >= 400 && err.status <= 599 && err.expose !== false) {
    const body = { message: err.message };
    // Only well-formed, application-defined codes are passed through (never driver/system codes like ECONNRESET).
    if (typeof err.code === 'string' && /^[A-Z][A-Z0-9_]{2,39}$/.test(err.code) && !/^E[A-Z]+$/.test(err.code)) body.code = err.code;
    return res.status(err.status).json(body);
  }
  // Unexpected failure: log server-side only, never return stack traces or database internals.
  console.error(err);
  res.status(500).json({ message: 'Server error' });
};

module.exports = { notFound, errorHandler };
