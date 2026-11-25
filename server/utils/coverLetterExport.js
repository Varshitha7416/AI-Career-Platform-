const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, TextRun, AlignmentType } = require('docx');

// Splits letter text into paragraphs (blank-line separated); single newlines stay as line breaks.
const toParagraphs = (text) => String(text || '')
  .replace(/\r\n?/g, '\n')
  .split(/\n\s*\n/)
  .map((p) => p.split('\n').map((l) => l.replace(/\s+$/g, '')))
  .filter((lines) => lines.some(Boolean));

// Built-in PDF fonts only cover WinAnsi. Map common symbols and replace the rest with '?'
// rather than rendering the wrong glyph (e.g. the rupee sign would show as a superscript 1).
const WINANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'.split(''));
const pdfSafe = (text) => String(text)
  .replace(/₹\s*/g, 'INR ')
  .replace(/[    ]/g, ' ')
  .replace(/[‐‑‒−]/g, '-')
  .replace(/→/g, '->')
  .replace(/[​-‍﻿]/g, '')
  .split('')
  .map((ch) => {
    const c = ch.charCodeAt(0);
    return (c === 10 || c === 9 || (c >= 32 && c <= 126) || (c >= 160 && c <= 255) || WINANSI_EXTRA.has(ch)) ? ch : '?';
  })
  .join('');

const toPdfBuffer = (text) => new Promise((resolve, reject) => {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 72, bottom: 72, left: 72, right: 72 }, info: { Title: 'Cover Letter' } });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  doc.on('end', () => resolve(Buffer.concat(chunks)));
  doc.on('error', reject);

  doc.font('Times-Roman').fontSize(11.5);
  const paras = toParagraphs(pdfSafe(text));
  paras.forEach((lines, i) => {
    doc.text(lines.join('\n'), { align: 'left', lineGap: 3, paragraphGap: 0 });
    if (i < paras.length - 1) doc.moveDown(0.9);
  });
  doc.end();
});

const toDocxBuffer = async (text) => {
  const paragraphs = toParagraphs(text).map((lines) => new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: 200, line: 276 },
    children: lines.map((line, i) => new TextRun({ text: line, font: 'Calibri', size: 22, break: i > 0 ? 1 : 0 })),
  }));
  const doc = new Document({
    creator: 'CareerNest',
    title: 'Cover Letter',
    sections: [{
      properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
      children: paragraphs,
    }],
  });
  return Packer.toBuffer(doc);
};

// "Cover-Letter-<Company>-<Title>" safe for a Content-Disposition filename.
const safePart = (s) => String(s || '')
  .normalize('NFKD').replace(/[^\x20-\x7E]/g, '')
  .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

const buildFileName = (company, title, ext) => {
  const parts = ['Cover-Letter', safePart(company), safePart(title)].filter(Boolean);
  return `${parts.join('-')}.${ext}`;
};

module.exports = { toPdfBuffer, toDocxBuffer, buildFileName };
