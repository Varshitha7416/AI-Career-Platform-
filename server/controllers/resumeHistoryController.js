const { isValidId } = require('../middleware/validate');
const { toFull, load } = require('./resumeAnalysisController');
const { compareAnalyses, targetLabel } = require('../utils/resumeAnalysisCompare');
const { toAnalysisPdf, buildExportFileName } = require('../utils/resumeAnalysisExport');

// GET /api/resume-analysis/compare?a=<id>&b=<id>  (every delta = b - a). Own analyses only; unknown or foreign id -> 404.
const compare = async (req, res, next) => {
  try {
    const { a, b } = req.query;
    if (!isValidId(a) || !isValidId(b)) return res.status(400).json({ message: 'Two valid analysis ids (a and b) are required' });
    if (String(a) === String(b)) return res.status(400).json({ message: 'Choose two different analyses to compare' });
    const [docA, docB] = await Promise.all([load({ _id: a, user: req.user.id }), load({ _id: b, user: req.user.id })]);
    if (!docA || !docB) return res.status(404).json({ message: 'Analysis not found' });
    res.status(200).json({ comparison: compareAnalyses(toFull(docA), toFull(docB)) });
  } catch (error) {
    next(error);
  }
};

// GET /api/resume-analysis/:id/export?format=pdf
const exportAnalysis = async (req, res, next) => {
  try {
    const format = String(req.query.format || 'pdf').toLowerCase();
    if (format !== 'pdf') return res.status(400).json({ message: 'Only format=pdf is supported' });
    const doc = await load({ _id: req.params.id, user: req.user.id });
    if (!doc) return res.status(404).json({ message: 'Analysis not found' });
    const a = toFull(doc);
    const name = a.resume ? (a.resume.name || a.resume.fileName) : (a.resumeSnapshot && (a.resumeSnapshot.name || a.resumeSnapshot.fileName)) || 'Resume';
    const label = a.resumeDeleted ? `${name} (resume no longer available)` : name;
    const pdf = await toAnalysisPdf(a, { resumeLabel: label, targetLabel: targetLabel(a) });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${buildExportFileName(name, a.createdAt, 'pdf')}"`,
      'Content-Length': String(pdf.length),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.status(200).send(pdf);
  } catch (error) {
    next(error);
  }
};

module.exports = { compare, exportAnalysis };
