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

const C = {
  navy:       '1B3A5C',
  headerBg:   '2B3E50',
  accentBlue: '2E75B6',
  lightBlue:  '7FB3D8',
  body:       '333333',
  muted:      '666666',
  white:      'FFFFFF',
  borderLight:'CCCCCC',
  altRow:     'F2F2F2',
  calloutBg:  'E3EFF8',
};

const PAGE_W  = 12240;
const PAGE_H  = 15840;
const MARGIN  = 1440;
const TABLE_W = PAGE_W - MARGIN * 2;

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

function run(text, opts = {}) {
  return new TextRun({
    text: String(text ?? ''),
    font: 'Arial',
    size: opts.size ?? 20,
    bold: opts.bold ?? false,
    italics: opts.italics ?? false,
    color: opts.color ?? C.body,
  });
}
function para(runs, opts = {}) {
  const runArray = Array.isArray(runs) ? runs : [runs];
  return new Paragraph({
    children: runArray,
    alignment: opts.align ?? AlignmentType.LEFT,
    spacing: { before: opts.spaceBefore ?? 0, after: opts.spaceAfter ?? 80 },
  });
}
function cell(children, opts = {}) {
  const childArray = Array.isArray(children) ? children : [children];
  return new TableCell({
    children: childArray,
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: opts.bg ? shading(opts.bg) : undefined,
    borders: opts.borders ?? cellBorders(),
    verticalAlign: opts.valign ?? VerticalAlign.TOP,
    margins: {
      top:    opts.padTop    ?? 80,
      bottom: opts.padBottom ?? 80,
      left:   opts.padLeft   ?? 100,
      right:  opts.padRight  ?? 100,
    },
    columnSpan: opts.span ?? undefined,
  });
}
function simpleTable(rows, opts = {}) {
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

function buildHeader(studentName) {
  return simpleTable([
    new TableRow({ children: [
      cell([
        para(run('STUDYCORE', { size: 18, bold: true, color: C.lightBlue })),
        para(run(`Meeting Script — ${studentName}`, { size: 36, bold: true, color: C.white }), { spaceAfter: 20 }),
        para(run(`SAT Prep Consultation | ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, { size: 20, italics: true, color: C.lightBlue })),
      ], {
        width: TABLE_W, bg: C.headerBg,
        padTop: 160, padBottom: 180, padLeft: 200,
        borders: cellBorders(),
      }),
    ]}),
  ]);
}

function buildSectionBlock(sectionTitle, duration, content) {
  const labelW  = 2200;
  const contentW = TABLE_W - labelW;

  return simpleTable([
    new TableRow({ children: [
      cell([
        para(run(sectionTitle, { size: 20, bold: true, color: C.white }), { spaceAfter: 40 }),
        para(run(duration, { size: 17, italics: true, color: C.lightBlue })),
      ], {
        width: labelW, bg: C.navy,
        padTop: 140, padBottom: 140, padLeft: 160,
        borders: cellBorders({ right: thinBorder(C.accentBlue) }),
      }),
      cell([
        para(run(content, { size: 19, color: C.body })),
      ], {
        width: contentW, bg: C.white,
        padTop: 140, padBottom: 140, padLeft: 160, padRight: 160,
        borders: cellBorders({ bottom: thinBorder() }),
      }),
    ]}),
  ]);
}

function buildStrategicQuestions(questions) {
  const headerRow = new TableRow({ children: [
    cell([para(run('STRATEGIC QUESTIONS', { size: 20, bold: true, color: C.white }))], {
      width: TABLE_W, bg: C.accentBlue, padTop: 100, padBottom: 100, padLeft: 160,
      borders: cellBorders(),
    }),
  ]});

  const qRows = (questions ?? []).map((q, i) =>
    new TableRow({ children: [
      cell([
        para([
          run(`${i + 1}. `, { size: 19, bold: true, color: C.accentBlue }),
          run(q, { size: 19, color: C.body }),
        ]),
      ], {
        width: TABLE_W,
        bg: i % 2 === 0 ? C.white : C.altRow,
        padTop: 100, padBottom: 100, padLeft: 160, padRight: 160,
        borders: cellBorders({ bottom: thinBorder() }),
      }),
    ]})
  );

  return simpleTable([headerRow, ...qRows]);
}

export async function buildMeetingScriptDocx(meetingScript, studentName) {
  const spacer = (pts = 120) => para(run(''), { spaceBefore: pts, spaceAfter: 0 });

  const sectionDefs = [
    { key: 'opening',          label: 'OPENING',            duration: '2–3 min' },
    { key: 'scoreWalkthrough', label: 'SCORE WALKTHROUGH',  duration: '5–7 min' },
    { key: 'opportunity',      label: 'THE OPPORTUNITY',    duration: '3–4 min' },
    { key: 'programStructure', label: 'PROGRAM STRUCTURE',  duration: '5–7 min' },
    { key: 'targetTimeline',   label: 'TARGET & TIMELINE',  duration: '3–4 min' },
    { key: 'collegeContext',   label: 'COLLEGE CONTEXT',    duration: '2–3 min' },
    { key: 'close',            label: 'THE CLOSE',          duration: '3–4 min' },
  ];

  const children = [
    buildHeader(studentName),
    spacer(100),
    para(run('How to use this script: Read the context and talking points — don\'t read verbatim. Adapt to the family\'s energy. The strategic questions at the end help you listen and tailor your close.', {
      size: 17, italics: true, color: C.muted,
    }), { spaceAfter: 100 }),
  ];

  for (const sec of sectionDefs) {
    const data = meetingScript[sec.key];
    if (data) {
      children.push(buildSectionBlock(sec.label, data.duration ?? sec.duration, data.content ?? ''));
      children.push(spacer(80));
    }
  }

  if (meetingScript.strategicQuestions?.length) {
    children.push(buildStrategicQuestions(meetingScript.strategicQuestions));
  }

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
            para(run('StudyCore — Meeting Script — Confidential', { size: 16, italics: true, color: C.muted }), { align: AlignmentType.RIGHT }),
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
            }),
          ],
        }),
      },
      children,
    }],
  });

  return Packer.toBuffer(doc);
}
