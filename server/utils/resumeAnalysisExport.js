const PDFDocument = require('pdfkit');
const { pdfSafe, safePart } = require('./coverLetterExport');

const DISCLAIMER = 'This report is an AI-generated assessment produced by CareerNest. It is advisory only, can contain mistakes, is not the result of any employer applicant tracking system (ATS) and does not predict hiring outcomes. Review every point yourself.';

const txt = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const list = (v) => (Array.isArray(v) ? v : []);
const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

// Plain-text rows per section: the structured `result` when present, else the flat legacy arrays.
const sections = (a) => {
  const r = a.result && typeof a.result === 'object' ? a.result : null;
  const strengths = r && list(r.strengths).length
    ? list(r.strengths).map((s) => txt(s && s.point ? s.point : s) + (s && s.explanation ? ` - ${txt(s.explanation)}` : ''))
    : list(a.strengths).map(txt);
  const missing = r && list(r.missingSkills).length
    ? list(r.missingSkills).map((s) => txt(s && s.skill ? s.skill : s) + (s && s.importance ? ` (${txt(s.importance)} priority)` : '') + (s && s.explanation ? `: ${txt(s.explanation)}` : ''))
    : list(a.missingSkills).map(txt);
  const suggestions = r && list(r.suggestions).length
    ? list(r.suggestions).map((s) => (s && s.title ? txt(s.title) + (s.detail ? `: ${txt(s.detail)}` : '') : txt(s)))
    : list(a.suggestions).map(txt);
  return { strengths: strengths.filter(Boolean), missing: missing.filter(Boolean), suggestions: suggestions.filter(Boolean) };
};

// Text only (pdfkit built-in fonts, pdfSafe strips unsupported glyphs): nothing user-supplied is interpreted as markup.
const toAnalysisPdf = (a, { resumeLabel, targetLabel }) => new Promise((resolve, reject) => {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 60, bottom: 60, left: 60, right: 60 }, info: { Title: 'CareerNest Resume Analysis', Author: 'CareerNest' } });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  doc.on('end', () => resolve(Buffer.concat(chunks)));
  doc.on('error', reject);

  const S = (t) => pdfSafe(txt(t));
  const heading = (t) => { doc.moveDown(0.9); doc.font('Helvetica-Bold').fontSize(13).fillColor('#163832').text(S(t)); doc.moveDown(0.3); };
  const body = (t) => doc.font('Helvetica').fontSize(10.5).fillColor('#111111').text(S(t), { lineGap: 2 });
  const bullets = (items, empty) => {
    if (!items.length) { doc.font('Helvetica-Oblique').fontSize(10.5).fillColor('#555555').text(empty); return; }
    items.forEach((i) => doc.font('Helvetica').fontSize(10.5).fillColor('#111111').text(`- ${S(i)}`, { lineGap: 2, indent: 8, paragraphGap: 3 }));
  };

  const { strengths, missing, suggestions } = sections(a);
  const score = a.overallScore ?? (a.result && a.result.overallScore);
  doc.font('Helvetica-Bold').fontSize(20).fillColor('#0B2B26').text('Resume Analysis Report');
  doc.font('Helvetica').fontSize(10).fillColor('#555555').text('CareerNest AI assessment');
  doc.moveDown(0.8);
  body(`Resume: ${resumeLabel}`);
  body(`Target: ${targetLabel}`);
  body(`Analysis date: ${fmtDate(a.createdAt)}`);
  body(`Type: ${a.type === 'job-specific' ? 'Job-specific' : 'General'}`);

  heading('Scores');
  body(`AI readiness score: ${typeof score === 'number' ? `${score} / 100` : 'not available'}`);
  body(`Job match: ${typeof a.matchPercentage === 'number' ? `${a.matchPercentage}%` : 'not applicable (general analysis)'}`);
  if (a.summary) { heading('Summary'); body(a.summary); }
  heading('Strengths');
  bullets(strengths, 'None recorded.');
  heading('Missing skills');
  bullets(missing, 'None recorded.');
  heading('Suggestions');
  bullets(suggestions, 'None recorded.');
  heading('Disclaimer');
  doc.font('Helvetica-Oblique').fontSize(9.5).fillColor('#333333').text(DISCLAIMER, { lineGap: 2 });
  doc.end();
});

const buildExportFileName = (resumeLabel, createdAt, ext) => `${['Resume-Analysis', safePart(resumeLabel), fmtDate(createdAt)].filter(Boolean).join('-')}.${ext}`;

module.exports = { toAnalysisPdf, buildExportFileName, sections };
