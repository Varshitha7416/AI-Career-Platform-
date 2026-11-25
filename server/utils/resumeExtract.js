const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');

const MAX_TEXT = 200000;

const bad = (message) => Object.assign(new Error(message), { status: 400 });

const extOf = (name) => {
  const m = /\.([a-z0-9]+)$/i.exec(String(name || ''));
  return m ? m[1].toLowerCase() : '';
};

// pdf-parse v2 injects page markers such as "-- 1 of 2 --"; they are not resume content.
const stripPageMarkers = (t) => String(t || '').replace(/^[ 	]*--\s*\d+\s+of\s+\d+\s*--[ 	]*$/gm, '');

const clean = (t) => stripPageMarkers(t)
  .replace(/\r\n?/g, '\n')
  .replace(/\u0000/g, '')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{4,}/g, '\n\n\n')
  .trim();

// Returns { text, fileType }. Throws an error with .status = 400 and a user-facing message.
const extractResume = async (buffer, originalName) => {
  const ext = extOf(originalName);
  if (!['pdf', 'docx', 'txt'].includes(ext)) throw bad('Only PDF, DOCX and TXT files are supported.');
  if (!buffer || buffer.length === 0) throw bad('The uploaded file is empty');

  let text = '';
  if (ext === 'pdf') {
    if (buffer.slice(0, 4).toString('latin1') !== '%PDF') throw bad('Invalid PDF file');
    try {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      text = result.text || '';
    } catch (err) {
      console.error('PDF parse error:', err.message);
      throw bad('Could not read this PDF. It may be corrupted or password protected.');
    }
    text = clean(text);
    if (!text) throw bad('No text could be extracted. Scanned/image-only PDFs are not supported.');
  } else if (ext === 'docx') {
    // DOCX is a zip container: "PK\x03\x04"
    if (!(buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04)) throw bad('Invalid DOCX file');
    try {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value || '';
    } catch (err) {
      console.error('DOCX parse error:', err.message);
      throw bad('Could not read this DOCX file. It may be corrupted.');
    }
    text = clean(text);
    if (!text) throw bad('No text could be extracted from this document.');
  } else {
    if (buffer.includes(0)) throw bad('This does not look like a plain text file.');
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      throw bad('The text file must be UTF-8 encoded.');
    }
    text = clean(text.replace(/^﻿/, ''));
    if (!text) throw bad('The text file is empty.');
  }

  if (text.length > MAX_TEXT) text = text.slice(0, MAX_TEXT);
  return { text, fileType: ext };
};

module.exports = { extractResume, extOf, stripPageMarkers, cleanResumeText: (t) => clean(t) };
