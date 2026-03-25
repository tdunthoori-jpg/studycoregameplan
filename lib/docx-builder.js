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
  HeadingLevel,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
  VerticalAlign,
  convertInchesToTwip,
} from 'docx';

// ─── Style Constants ──────────────────────────────────────────────────────────
const C = {
  navy:       '1B3A5C',
  headerBg:   '2B3E50',
  accentBlue: '2E75B6',
  lightBlue:  '7FB3D8',
  green:      '27AE60',
  orange:     'D4740E',
  red:        'C0392B',
  phaseBg:    'D94F3B',
  calloutBg:  'E3EFF8',
  infoBg:     'F7F7F7',
  body:       '333333',
  muted:      '666666',
  white:      'FFFFFF',
  borderLight:'CCCCCC',
  altRow:     'F2F2F2',
};

const PAGE_W   = 12240; // US Letter in DXA
const PAGE_H   = 15840;
const MARGIN   = 1440;  // 1 inch
const TABLE_W  = PAGE_W - MARGIN * 2; // 9360

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

// ─── Text helpers ─────────────────────────────────────────────────────────────
function run(text, opts = {}) {
  return new TextRun({
    text: String(text ?? ''),
    font: 'Arial',
    size: opts.size ?? 20,
    bold: opts.bold ?? false,
    italics: opts.italics ?? false,
    color: opts.color ?? C.body,
    break: opts.break ?? undefined,
  });
}

function para(runs, opts = {}) {
  const runArray = Array.isArray(runs) ? runs : [runs];
  return new Paragraph({
    children: runArray,
    alignment: opts.align ?? AlignmentType.LEFT,
    spacing: { before: opts.spaceBefore ?? 0, after: opts.spaceAfter ?? 60 },
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

function row(cells) {
  return new TableRow({ children: cells });
}

function table(rows, opts = {}) {
  return new Table({
    rows,
    width: { size: opts.width ?? TABLE_W, type: WidthType.DXA },
    borders: opts.borders ?? {
      top: noBorder(), bottom: noBorder(),
      left: noBorder(), right: noBorder(),
      insideH: noBorder(), insideV: noBorder(),
    },
    margins: opts.margins ?? undefined,
  });
}

// ─── Document Sections ────────────────────────────────────────────────────────

function buildTitleBar(studentName, tagline) {
  return table([
    row([
      cell([
        para(run('STUDYCORE', { size: 18, bold: true, color: C.lightBlue }), { align: AlignmentType.LEFT }),
        para(run(`${studentName}'s SAT Prep Game Plan`, { size: 40, bold: true, color: C.white }), { align: AlignmentType.LEFT, spaceAfter: 20 }),
        para(run(tagline, { size: 22, italics: true, color: C.lightBlue }), { align: AlignmentType.LEFT }),
      ], { bg: C.headerBg, width: TABLE_W, padLeft: 200, padTop: 160, padBottom: 180, borders: cellBorders() }),
    ]),
  ]);
}

function buildScoreBoxes(scoreBoxes) {
  const colW = Math.floor(TABLE_W / 4);
  const boxes = [scoreBoxes.box1, scoreBoxes.box2, scoreBoxes.box3, scoreBoxes.box4];
  const colors = [C.accentBlue, C.navy, C.green, C.orange];

  const cells = boxes.map((box, i) =>
    cell([
      para(run((box?.label ?? '').toUpperCase(), { size: 15, bold: true, color: C.muted }), { align: AlignmentType.CENTER }),
      para(run(box?.value ?? '—', { size: 44, bold: true, color: colors[i] }), { align: AlignmentType.CENTER, spaceBefore: 30 }),
      para(run(box?.subtitle ?? '', { size: 15, color: C.muted }), { align: AlignmentType.CENTER }),
    ], {
      width: colW,
      bg: C.white,
      padTop: 120,
      padBottom: 120,
      borders: cellBorders({
        right: i < 3 ? thinBorder(C.borderLight) : noBorder(),
        bottom: thinBorder(C.borderLight),
        top: thinBorder(C.borderLight),
        left: i === 0 ? thinBorder(C.borderLight) : noBorder(),
      }),
    })
  );

  return table([row(cells)]);
}

function buildInfoBar(planData) {
  const items = [
    { label: 'PLAN CREATED', value: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) },
    { label: 'DURATION', value: planData.programOverview?.duration ?? '' },
    { label: 'TOTAL HOURS', value: planData.programOverview?.sessions ?? '' },
    { label: 'TARGET', value: planData.programOverview?.target ?? '' },
  ];

  const runs = [];
  items.forEach((item, i) => {
    runs.push(run(item.label + ': ', { size: 16, bold: true, color: C.navy }));
    runs.push(run(item.value, { size: 16, color: C.body }));
    if (i < items.length - 1) runs.push(run('   |   ', { size: 16, color: C.muted }));
  });

  return table([
    row([
      cell([para(runs, { align: AlignmentType.LEFT })], {
        width: TABLE_W, bg: C.infoBg, padTop: 100, padBottom: 100, padLeft: 160,
        borders: cellBorders({ top: thinBorder(), bottom: thinBorder() }),
      }),
    ]),
  ]);
}

function buildCalloutBox(title, body, type = 'blue') {
  const bg     = type === 'blue' ? C.calloutBg : 'FDF2E9';
  const border = type === 'blue' ? C.accentBlue : C.orange;
  const tc     = type === 'blue' ? C.accentBlue : C.orange;

  return table([
    row([
      cell([
        para(run(title, { size: 20, bold: true, color: tc }), { spaceAfter: 60 }),
        para(run(body, { size: 19, color: C.body })),
      ], {
        width: TABLE_W, bg,
        padTop: 120, padBottom: 120, padLeft: 160, padRight: 160,
        borders: cellBorders({
          left: { style: BorderStyle.SINGLE, size: 18, color: border },
          top: thinBorder(border),
          bottom: thinBorder(border),
          right: thinBorder(border),
        }),
      }),
    ]),
  ]);
}

function buildSectionHeading(number, title) {
  return para(
    [run(`${number}. `, { size: 28, bold: true, color: C.accentBlue }),
     run(title, { size: 28, bold: true, color: C.accentBlue })],
    { spaceBefore: 200, spaceAfter: 100 }
  );
}

function buildDomainPriorityTable(domainPriority) {
  const headerRow = row([
    cell([para(run('DOMAIN', { size: 16, bold: true, color: C.white }))], { width: 3000, bg: C.navy, borders: cellBorders() }),
    cell([para(run('PERFORMANCE', { size: 16, bold: true, color: C.white }))], { width: 2200, bg: C.navy, borders: cellBorders() }),
    cell([para(run('TARGET', { size: 16, bold: true, color: C.white }))], { width: 2000, bg: C.navy, borders: cellBorders() }),
    cell([para(run('PRIORITY', { size: 16, bold: true, color: C.white }))], { width: 2160, bg: C.navy, borders: cellBorders() }),
  ]);

  const rwLabelRow = row([
    cell([para(run('READING & WRITING', { size: 16, bold: true, color: C.white }))], {
      span: 4, bg: C.accentBlue, borders: cellBorders(),
    }),
  ]);

  const mathLabelRow = row([
    cell([para(run('MATH', { size: 16, bold: true, color: C.white }))], {
      span: 4, bg: C.accentBlue, borders: cellBorders(),
    }),
  ]);

  function priorityColor(p) {
    if (p === 'High') return C.red;
    if (p === 'Medium') return C.orange;
    if (p === 'Low') return C.green;
    return C.accentBlue; // Protect
  }

  const rwDomainNames = ['Craft & Structure', 'Information & Ideas', 'Expression of Ideas', 'Standard English Conventions'];
  const mathDomainNames = ['Algebra', 'Advanced Math', 'Problem-Solving & Data Analysis', 'Geometry & Trigonometry'];

  function buildDomainRow(d, idx) {
    const bg = idx % 2 === 0 ? C.white : C.altRow;
    return row([
      cell([para(run(d.domain, { size: 18 }))], { width: 3000, bg, borders: cellBorders({ bottom: thinBorder() }) }),
      cell([para(run(d.performance, { size: 18 }))], { width: 2200, bg, borders: cellBorders({ bottom: thinBorder() }) }),
      cell([para(run(d.target, { size: 18 }))], { width: 2000, bg, borders: cellBorders({ bottom: thinBorder() }) }),
      cell([para(run(d.priority, { size: 18, bold: true, color: priorityColor(d.priority) }))], { width: 2160, bg, borders: cellBorders({ bottom: thinBorder() }) }),
    ]);
  }

  const rwDomains = domainPriority.filter(d => rwDomainNames.some(n => d.domain?.includes(n.split(' ')[0])));
  const mathDomains = domainPriority.filter(d => mathDomainNames.some(n => d.domain?.includes(n.split(' ')[0])));
  // Fallback: split by order if filtering doesn't work well
  const half = Math.ceil(domainPriority.length / 2);
  const rwRows = (rwDomains.length > 0 ? rwDomains : domainPriority.slice(0, half)).map(buildDomainRow);
  const mathRows = (mathDomains.length > 0 ? mathDomains : domainPriority.slice(half)).map(buildDomainRow);

  return table([headerRow, rwLabelRow, ...rwRows, mathLabelRow, ...mathRows]);
}

function buildFocusAreas(focusAreas) {
  const colW = Math.floor(TABLE_W / 2);
  function focusCell(area, bg = C.white) {
    return cell([
      para(run(`${area.number}. ${area.title}`, { size: 20, bold: true, color: C.navy }), { spaceAfter: 80 }),
      para(run(area.body, { size: 18, color: C.body })),
    ], {
      width: colW, bg,
      padTop: 140, padBottom: 140, padLeft: 160, padRight: 160,
      borders: cellBorders({ right: thinBorder(), bottom: thinBorder(), top: thinBorder(), left: thinBorder() }),
    });
  }

  const rows = [];
  for (let i = 0; i < focusAreas.length; i += 2) {
    const a = focusAreas[i];
    const b = focusAreas[i + 1];
    const rowBg = i >= focusAreas.length - 2 ? C.altRow : C.white;
    rows.push(row([
      focusCell(a, rowBg),
      b ? focusCell(b, rowBg) : cell([para(run(''))], { width: colW }),
    ]));
  }
  return table(rows);
}

function buildPhaseHeader(title) {
  return table([
    row([
      cell([
        para(run(title, { size: 24, bold: true, color: C.white }), { align: AlignmentType.LEFT }),
      ], {
        width: TABLE_W, bg: C.phaseBg, padTop: 120, padBottom: 120, padLeft: 160,
        borders: cellBorders(),
      }),
    ]),
  ]);
}

function buildWeekCard(week) {
  const sidebarW = 1000;
  const contentW = 5200;
  const hwW      = TABLE_W - sidebarW - contentW;

  const sidebarCell = cell([
    para(run('WK', { size: 16, bold: true, color: C.white }), { align: AlignmentType.CENTER }),
    para(run(week.weekNum ?? '', { size: 32, bold: true, color: C.white }), { align: AlignmentType.CENTER, spaceBefore: 20 }),
    para(run(week.dateRange ?? '', { size: 15, color: C.white }), { align: AlignmentType.CENTER, spaceBefore: 20 }),
  ], {
    width: sidebarW, bg: C.phaseBg, valign: VerticalAlign.CENTER,
    borders: cellBorders(),
  });

  const contentRuns = [
    para(run(week.title ?? '', { size: 22, bold: true, color: C.navy }), { spaceAfter: 80 }),
    para(run(week.sessionContent ?? '', { size: 18, color: C.body }), { spaceAfter: 80 }),
  ];
  if (week.testTarget) {
    contentRuns.push(para(run(week.testTarget, { size: 18, italics: true, color: C.orange })));
  }

  const contentCell = cell(contentRuns, {
    width: contentW, bg: C.white,
    padTop: 120, padBottom: 120, padLeft: 160,
    borders: cellBorders({ right: thinBorder() }),
  });

  const hwItems = (week.homework ?? []).map(hw =>
    para([run('• ', { size: 18, bold: true, color: C.accentBlue }), run(hw, { size: 18, color: C.body })], { spaceAfter: 60 })
  );
  const hwCell = cell(
    [para(run('HOMEWORK', { size: 15, bold: true, color: C.navy }), { spaceAfter: 80 }), ...hwItems],
    { width: hwW, bg: C.infoBg, padTop: 120, padBottom: 120, padLeft: 140, borders: cellBorders() }
  );

  return table([row([sidebarCell, contentCell, hwCell])], {
    width: TABLE_W,
    borders: {
      top: thinBorder(C.borderLight), bottom: thinBorder(C.borderLight),
      left: noBorder(), right: noBorder(), insideH: noBorder(), insideV: noBorder(),
    },
  });
}

function buildScoreProgressionTable(scoreProgression) {
  const colWidths = [2500, 1700, 1700, 1700, 1760];

  const headerRow = row([
    cell([para(run('MILESTONE', { size: 16, bold: true, color: C.white }))], { width: colWidths[0], bg: C.navy, borders: cellBorders() }),
    cell([para(run('TOTAL', { size: 16, bold: true, color: C.white }), { align: AlignmentType.CENTER })], { width: colWidths[1], bg: C.navy, borders: cellBorders() }),
    cell([para(run('R/W', { size: 16, bold: true, color: C.white }), { align: AlignmentType.CENTER })], { width: colWidths[2], bg: C.navy, borders: cellBorders() }),
    cell([para(run('MATH', { size: 16, bold: true, color: C.white }), { align: AlignmentType.CENTER })], { width: colWidths[3], bg: C.navy, borders: cellBorders() }),
    cell([para(run('', { size: 16, bold: true, color: C.white }))], { width: colWidths[4], bg: C.navy, borders: cellBorders() }),
  ]);

  const dataRows = (scoreProgression.rows ?? []).map((r, i) => {
    const isLast = i === (scoreProgression.rows.length - 1);
    const bg = isLast ? 'E8F5E9' : (i % 2 === 0 ? C.white : C.altRow);
    const textColor = isLast ? C.green : C.body;
    return row([
      cell([para(run(r.milestone, { size: 18, bold: isLast, color: textColor }))], { width: colWidths[0], bg, borders: cellBorders({ bottom: thinBorder() }) }),
      cell([para(run(r.total, { size: 18, bold: isLast, color: isLast ? C.green : C.body }), { align: AlignmentType.CENTER })], { width: colWidths[1], bg, borders: cellBorders({ bottom: thinBorder() }) }),
      cell([para(run(r.rw, { size: 18, bold: isLast, color: C.accentBlue }), { align: AlignmentType.CENTER })], { width: colWidths[2], bg, borders: cellBorders({ bottom: thinBorder() }) }),
      cell([para(run(r.math, { size: 18, bold: isLast, color: C.orange }), { align: AlignmentType.CENTER })], { width: colWidths[3], bg, borders: cellBorders({ bottom: thinBorder() }) }),
      cell([para(run(r.indicator ?? '', { size: 18, color: C.muted }), { align: AlignmentType.CENTER })], { width: colWidths[4], bg, borders: cellBorders({ bottom: thinBorder() }) }),
    ]);
  });

  return table([headerRow, ...dataRows]);
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export async function buildGamePlanDocx(gamePlan, studentName) {
  const sections = [];

  // Spacer paragraph helper
  const spacer = (pts = 120) => para(run(''), { spaceBefore: pts, spaceAfter: 0 });

  // 1. Title bar
  sections.push(buildTitleBar(studentName, gamePlan.tagline ?? ''));
  sections.push(spacer(80));

  // 2. Score boxes
  if (gamePlan.scoreBoxes) {
    sections.push(buildScoreBoxes(gamePlan.scoreBoxes));
    sections.push(spacer(80));
  }

  // 3. Info bar
  if (gamePlan.programOverview) {
    sections.push(buildInfoBar(gamePlan));
    sections.push(spacer(80));
  }

  // 4. Main callout
  if (gamePlan.mainCallout) {
    sections.push(buildCalloutBox(gamePlan.mainCallout.title, gamePlan.mainCallout.body, 'blue'));
    sections.push(spacer(80));
  }

  // 5. Bottleneck callout
  if (gamePlan.bottleneckCallout) {
    sections.push(buildCalloutBox(gamePlan.bottleneckCallout.title, gamePlan.bottleneckCallout.body, 'orange'));
    sections.push(spacer(80));
  }

  // 6. Score analysis
  sections.push(buildSectionHeading('1', 'Score Analysis'));
  sections.push(para(run(gamePlan.scoreAnalysis ?? '', { size: 19, color: C.body }), { spaceAfter: 80 }));

  // 7. Domain priority
  if (gamePlan.domainPriority?.length) {
    sections.push(buildSectionHeading('2', 'Domain Priority'));
    sections.push(buildDomainPriorityTable(gamePlan.domainPriority));
    sections.push(spacer(80));
  }

  // 8. Program overview
  if (gamePlan.programOverview) {
    sections.push(buildSectionHeading('3', 'Program Overview'));
    const po = gamePlan.programOverview;
    const details = [
      ['Duration', po.duration], ['Sessions', po.sessions], ['Structure', po.structure],
      ['Homework', po.homework], ['Practice Tests', po.practiceTests], ['Target', po.target],
    ].filter(([, v]) => v);
    for (const [label, value] of details) {
      sections.push(para(
        [run(label + ': ', { size: 19, bold: true, color: C.navy }),
         run(value, { size: 19, color: C.body })],
        { spaceAfter: 60 }
      ));
    }
    sections.push(spacer(60));
  }

  // 9. Focus areas
  if (gamePlan.focusAreas?.length) {
    sections.push(buildSectionHeading('4', 'Focus Areas'));
    sections.push(buildFocusAreas(gamePlan.focusAreas));
    sections.push(spacer(80));
  }

  // 10. Week-by-week plan
  sections.push(buildSectionHeading('5', 'Week-by-Week Plan'));
  if (gamePlan.weekByWeekIntro) {
    sections.push(para(run(gamePlan.weekByWeekIntro, { size: 19, italics: true, color: C.muted }), { spaceAfter: 100 }));
  }

  for (const phase of gamePlan.phases ?? []) {
    sections.push(buildPhaseHeader(phase.title));
    if (phase.description) {
      sections.push(para(run(phase.description, { size: 18, color: C.body }), { spaceBefore: 60, spaceAfter: 60 }));
    }
    for (const week of phase.weeks ?? []) {
      sections.push(buildWeekCard(week));
      sections.push(spacer(60));
    }
    if (phase.phaseComplete) {
      sections.push(para(run(phase.phaseComplete, { size: 18, italics: true, color: C.muted }), { spaceAfter: 120 }));
    }
  }

  // 11. Score progression
  if (gamePlan.scoreProgression) {
    sections.push(buildSectionHeading('6', 'Score Progression'));
    if (gamePlan.scoreProgression.intro) {
      sections.push(para(run(gamePlan.scoreProgression.intro, { size: 18, color: C.body }), { spaceAfter: 80 }));
    }
    sections.push(buildScoreProgressionTable(gamePlan.scoreProgression));
    if (gamePlan.scoreProgression.note) {
      sections.push(para(run(gamePlan.scoreProgression.note, { size: 17, italics: true, color: C.muted }), { spaceBefore: 80 }));
    }
    sections.push(spacer(80));
  }

  // 12. Bottom line
  if (gamePlan.bottomLine) {
    sections.push(buildCalloutBox('The Bottom Line', gamePlan.bottomLine, 'blue'));
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
            para(run('StudyCore SAT Prep — Confidential', { size: 16, italics: true, color: C.muted }), { align: AlignmentType.RIGHT }),
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
      children: sections,
    }],
  });

  return Packer.toBuffer(doc);
}
