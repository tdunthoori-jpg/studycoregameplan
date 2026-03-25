import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  AlignmentType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  VerticalAlign,
} from 'docx';

// ─── Style constants ──────────────────────────────────────────────────────────
const C = {
  navy:       '1B3A5C',
  headerBg:   '2B3E50',
  accentBlue: '2E75B6',
  lightBlue:  '7FB3D8',
  body:       '333333',
  muted:      '666666',
  stage:      '7B8FA1',   // stage direction color
  white:      'FFFFFF',
  borderLight:'CCCCCC',
  altRow:     'F2F2F2',
  sectionBg:  'EAF3FB',
};

const PAGE_W  = 12240;
const PAGE_H  = 15840;
const MARGIN  = 1440;
const TABLE_W = PAGE_W - MARGIN * 2;

// ─── Docx helpers ─────────────────────────────────────────────────────────────
function shading(color) {
  return { type: ShadingType.CLEAR, color: 'auto', fill: color };
}
function noBorder() {
  return { style: BorderStyle.NONE, size: 0, color: 'auto' };
}
function thinBorder(color = C.borderLight) {
  return { style: BorderStyle.SINGLE, size: 4, color };
}
function cellBorders(opts = {}) {
  const none = noBorder();
  return {
    top:    opts.top    ?? none,
    bottom: opts.bottom ?? none,
    left:   opts.left   ?? none,
    right:  opts.right  ?? none,
  };
}

function makeCell(children, opts = {}) {
  return new TableCell({
    children: Array.isArray(children) ? children : [children],
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: opts.bg ? shading(opts.bg) : undefined,
    borders: opts.borders ?? cellBorders(),
    verticalAlign: opts.valign ?? VerticalAlign.TOP,
    margins: {
      top:    opts.padTop    ?? 80,
      bottom: opts.padBottom ?? 80,
      left:   opts.padLeft   ?? 120,
      right:  opts.padRight  ?? 120,
    },
    columnSpan: opts.span ?? undefined,
  });
}

function makeTable(rows, opts = {}) {
  return new Table({
    rows,
    width: { size: opts.width ?? TABLE_W, type: WidthType.DXA },
    borders: {
      top: noBorder(), bottom: noBorder(),
      left: noBorder(), right: noBorder(),
      insideH: noBorder(), insideV: noBorder(),
    },
  });
}

// ─── Inline markdown parser ───────────────────────────────────────────────────
// Handles: **bold**, [stage directions], and plain text within a single line.
function parseInlineRuns(text, defaultSize = 20, defaultColor = C.body) {
  const runs = [];
  let remaining = text;

  while (remaining.length > 0) {
    // [stage direction] → italic, muted color
    const stageMatch = remaining.match(/^\[([^\]]+)\]/);
    if (stageMatch) {
      runs.push(new TextRun({
        text: stageMatch[0],
        font: 'Arial',
        size: defaultSize - 1,
        italics: true,
        color: C.stage,
      }));
      remaining = remaining.slice(stageMatch[0].length);
      continue;
    }

    // **bold** → bold, navy
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
    if (boldMatch) {
      runs.push(new TextRun({
        text: boldMatch[1],
        font: 'Arial',
        size: defaultSize,
        bold: true,
        color: C.navy,
      }));
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Plain text up to the next special sequence
    const next = remaining.search(/\[|\*\*/);
    if (next <= 0) {
      if (remaining.length > 0) {
        runs.push(new TextRun({ text: remaining, font: 'Arial', size: defaultSize, color: defaultColor }));
      }
      remaining = '';
    } else {
      runs.push(new TextRun({ text: remaining.slice(0, next), font: 'Arial', size: defaultSize, color: defaultColor }));
      remaining = remaining.slice(next);
    }
  }

  return runs.length > 0 ? runs : [new TextRun({ text: '', font: 'Arial', size: defaultSize })];
}

// ─── Document builders ────────────────────────────────────────────────────────

function buildDocHeader(studentName) {
  return makeTable([
    new TableRow({ children: [
      makeCell([
        new Paragraph({
          children: [new TextRun({ text: 'STUDYCORE', font: 'Arial', size: 18, bold: true, color: C.lightBlue })],
          spacing: { before: 0, after: 40 },
        }),
        new Paragraph({
          children: [new TextRun({ text: `Meeting Script — ${studentName}`, font: 'Arial', size: 36, bold: true, color: C.white })],
          spacing: { before: 0, after: 40 },
        }),
        new Paragraph({
          children: [new TextRun({
            text: `SAT Prep Consultation  ·  ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
            font: 'Arial', size: 19, italics: true, color: C.lightBlue,
          })],
          spacing: { before: 0, after: 0 },
        }),
      ], { width: TABLE_W, bg: C.headerBg, padTop: 160, padBottom: 180, padLeft: 200, borders: cellBorders() }),
    ]}),
  ]);
}

function buildUsageNote() {
  return makeTable([
    new TableRow({ children: [
      makeCell([
        new Paragraph({
          children: [new TextRun({
            text: 'How to use this script: Read the talking points — don\'t read verbatim. Adapt to the family\'s energy. Bold text = key phrases to hit. [Brackets] = stage directions for you.',
            font: 'Arial', size: 17, italics: true, color: C.muted,
          })],
          spacing: { before: 0, after: 0 },
        }),
      ], {
        width: TABLE_W, bg: C.altRow,
        padTop: 100, padBottom: 100, padLeft: 160, padRight: 160,
        borders: cellBorders({ top: thinBorder(), bottom: thinBorder() }),
      }),
    ]}),
  ]);
}

// Section header bar (## lines)
function buildSectionHeader(title) {
  return makeTable([
    new TableRow({ children: [
      makeCell([
        new Paragraph({
          children: [new TextRun({ text: title, font: 'Arial', size: 24, bold: true, color: C.white })],
          spacing: { before: 0, after: 0 },
        }),
      ], {
        width: TABLE_W, bg: C.navy,
        padTop: 120, padBottom: 120, padLeft: 180,
        borders: cellBorders(),
      }),
    ]}),
  ]);
}

// Body paragraph — handles inline bold + stage directions
function buildBodyParagraph(text, opts = {}) {
  const runs = parseInlineRuns(text, opts.size ?? 20, opts.color ?? C.body);
  return new Paragraph({
    children: runs,
    spacing: { before: opts.spaceBefore ?? 60, after: opts.spaceAfter ?? 80 },
    indent: opts.indent ? { left: 200 } : undefined,
  });
}

// Bullet paragraph
function buildBullet(text) {
  const contentRuns = parseInlineRuns(text, 19, C.body);
  return new Paragraph({
    children: [
      new TextRun({ text: '•  ', font: 'Arial', size: 20, bold: true, color: C.accentBlue }),
      ...contentRuns,
    ],
    spacing: { before: 40, after: 60 },
    indent: { left: 240 },
  });
}

// Horizontal rule (--- lines)
function buildDivider() {
  return makeTable([
    new TableRow({ children: [
      makeCell([new Paragraph({ children: [new TextRun({ text: '' })], spacing: { before: 0, after: 0 } })], {
        width: TABLE_W,
        borders: cellBorders({ bottom: thinBorder() }),
        padTop: 0, padBottom: 0,
      }),
    ]}),
  ]);
}

// ─── Markdown → docx elements ─────────────────────────────────────────────────
function markdownToElements(markdown) {
  const elements = [];
  const lines = markdown.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();

    // Blank line → small spacer (skip duplicates)
    if (line.trim() === '') {
      // Only add a spacer if the previous element wasn't also a spacer/header
      const last = elements[elements.length - 1];
      const lastIsSpacerOrHeader = !last || last._type === 'spacer' || last._type === 'header';
      if (!lastIsSpacerOrHeader) {
        const spacer = new Paragraph({ children: [new TextRun({ text: '' })], spacing: { before: 40, after: 40 } });
        spacer._type = 'spacer';
        elements.push(spacer);
      }
      continue;
    }

    // Horizontal rule ---
    if (/^---+$/.test(line.trim())) {
      elements.push(buildDivider());
      continue;
    }

    // ## Section header
    if (line.startsWith('## ')) {
      const title = line.slice(3).trim();
      const el = buildSectionHeader(title);
      el._type = 'header';
      elements.push(el);
      continue;
    }

    // # Top-level header (treat like ## but slightly larger — shouldn't appear but handle gracefully)
    if (line.startsWith('# ')) {
      const title = line.slice(2).trim();
      elements.push(buildSectionHeader(title));
      continue;
    }

    // * or - bullet
    if (/^[\*\-]\s+/.test(line)) {
      const text = line.replace(/^[\*\-]\s+/, '');
      elements.push(buildBullet(text));
      continue;
    }

    // Numbered list: 1. 2. 3. etc.
    if (/^\d+\.\s+/.test(line)) {
      const numMatch = line.match(/^(\d+)\.\s+(.*)/);
      if (numMatch) {
        const num = numMatch[1];
        const text = numMatch[2];
        const contentRuns = parseInlineRuns(text, 19, C.body);
        elements.push(new Paragraph({
          children: [
            new TextRun({ text: `${num}.  `, font: 'Arial', size: 20, bold: true, color: C.accentBlue }),
            ...contentRuns,
          ],
          spacing: { before: 40, after: 60 },
          indent: { left: 240 },
        }));
      }
      continue;
    }

    // A line that is entirely a stage direction [...]
    if (/^\[.+\]$/.test(line.trim())) {
      elements.push(new Paragraph({
        children: [new TextRun({ text: line.trim(), font: 'Arial', size: 18, italics: true, color: C.stage })],
        spacing: { before: 40, after: 60 },
        indent: { left: 120 },
      }));
      continue;
    }

    // Regular body paragraph (may contain inline **bold** and [instructions])
    elements.push(buildBodyParagraph(line));
  }

  return elements;
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export async function buildMeetingScriptDocx(markdownText, studentName) {
  const bodyElements = markdownToElements(markdownText);

  const spacer = (pts = 100) => new Paragraph({
    children: [new TextRun({ text: '' })],
    spacing: { before: pts, after: 0 },
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_W, height: PAGE_H },
          margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [new TextRun({ text: `StudyCore Meeting Script — ${studentName} — Confidential`, font: 'Arial', size: 16, italics: true, color: C.muted })],
              alignment: AlignmentType.RIGHT,
              spacing: { before: 0, after: 0 },
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: 'StudyCore | Page ', font: 'Arial', size: 16, color: C.muted }),
                new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 16, color: C.muted }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 0 },
            }),
          ],
        }),
      },
      children: [
        buildDocHeader(studentName),
        spacer(100),
        buildUsageNote(),
        spacer(120),
        ...bodyElements,
      ],
    }],
  });

  return Packer.toBuffer(doc);
}
