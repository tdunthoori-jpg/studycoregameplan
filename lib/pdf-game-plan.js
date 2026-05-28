import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';

const C = {
  navy:        '#1B365D',
  blue:        '#2E75B6',
  green:       '#27AE60',
  orange:      '#D4740E',
  white:       '#FFFFFF',
  offWhite:    '#F7FAFD',
  lightBlue:   '#EAF3FB',
  lightOrange: '#FFF3E0',
  border:      '#DDE3EC',
  textDark:    '#1A1A1A',
  textMid:     '#444444',
  textLight:   '#777777',
};

const BOX_COLORS = [
  { bg: C.navy,   label: '#7FB3D8', value: C.white,  sub: '#B8CDE0' },
  { bg: C.green,  label: '#C8F0D8', value: C.white,  sub: '#C8F0D8' },
  { bg: C.orange, label: '#F5D5A8', value: C.white,  sub: '#F5D5A8' },
  { bg: C.blue,   label: '#C0D8F0', value: C.white,  sub: '#C0D8F0' },
];

const PRIORITY_STYLES = {
  High:    { backgroundColor: '#FDEDEC', color: '#C0392B' },
  Medium:  { backgroundColor: '#FEF3E2', color: '#D4740E' },
  Low:     { backgroundColor: '#EBF5FB', color: '#2E75B6' },
  Protect: { backgroundColor: '#EAFAF1', color: '#27AE60' },
};

const s = StyleSheet.create({
  page: {
    backgroundColor: C.white,
    paddingTop: 36,
    paddingBottom: 44,
    paddingLeft: 40,
    paddingRight: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: C.textDark,
  },
  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: C.navy,
    borderRadius: 4,
    padding: 16,
    marginBottom: 12,
  },
  headerBrand: {
    color: '#7FB3D8',
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 2,
    marginBottom: 3,
  },
  headerName: {
    color: C.white,
    fontSize: 17,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 3,
  },
  headerTagline: {
    color: '#B8CDE0',
    fontSize: 9,
    fontFamily: 'Helvetica-Oblique',
  },
  // ── Score boxes ─────────────────────────────────────────────────────────────
  scoreRow: {
    flexDirection: 'row',
    marginBottom: 10,
    gap: 6,
  },
  scoreBox: {
    flex: 1,
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  scoreBoxLabel: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.8,
    marginBottom: 4,
    textAlign: 'center',
  },
  scoreBoxValue: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  scoreBoxSub: {
    fontSize: 7,
    textAlign: 'center',
  },
  // ── Callout boxes ───────────────────────────────────────────────────────────
  calloutBlue: {
    backgroundColor: C.lightBlue,
    borderLeftWidth: 3,
    borderLeftColor: C.blue,
    borderLeftStyle: 'solid',
    borderRadius: 3,
    padding: 10,
    marginBottom: 8,
  },
  calloutOrange: {
    backgroundColor: C.lightOrange,
    borderLeftWidth: 3,
    borderLeftColor: C.orange,
    borderLeftStyle: 'solid',
    borderRadius: 3,
    padding: 10,
    marginBottom: 8,
  },
  calloutLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  calloutBody: {
    fontSize: 9.5,
    lineHeight: 1.55,
    color: C.textMid,
  },
  // ── Section bar ─────────────────────────────────────────────────────────────
  sectionBar: {
    backgroundColor: C.navy,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 3,
    marginTop: 12,
    marginBottom: 6,
  },
  sectionBarText: {
    color: C.white,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
  },
  // ── Body text ────────────────────────────────────────────────────────────────
  body: {
    fontSize: 9.5,
    lineHeight: 1.6,
    color: C.textMid,
    marginBottom: 6,
  },
  // ── Tables ──────────────────────────────────────────────────────────────────
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: C.navy,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    borderBottomStyle: 'solid',
  },
  tableRowAlt: {
    flexDirection: 'row',
    backgroundColor: C.offWhite,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    borderBottomStyle: 'solid',
  },
  tableHeaderCell: {
    flex: 1,
    paddingVertical: 5,
    paddingHorizontal: 8,
    color: C.white,
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
  },
  tableCell: {
    flex: 1,
    paddingVertical: 5,
    paddingHorizontal: 8,
    fontSize: 8.5,
    color: C.textDark,
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    alignSelf: 'flex-start',
  },
  // ── Program overview ────────────────────────────────────────────────────────
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 8,
  },
  overviewItem: {
    width: '31%',
    backgroundColor: C.offWhite,
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: 'solid',
    borderRadius: 3,
    padding: 7,
  },
  overviewLabel: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: C.blue,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  overviewValue: {
    fontSize: 8.5,
    color: C.textDark,
    lineHeight: 1.4,
  },
  // ── Focus areas ─────────────────────────────────────────────────────────────
  focusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  focusCard: {
    width: '47%',
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: 'solid',
    borderTopWidth: 3,
    borderTopColor: C.blue,
    borderTopStyle: 'solid',
    borderRadius: 3,
    padding: 8,
  },
  focusNum: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: C.border,
    marginBottom: 2,
  },
  focusTitle: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: C.navy,
    marginBottom: 3,
  },
  focusBody: {
    fontSize: 8,
    lineHeight: 1.5,
    color: C.textMid,
  },
  // ── Phase / week cards ──────────────────────────────────────────────────────
  phaseBar: {
    backgroundColor: C.blue,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 3,
    marginTop: 8,
    marginBottom: 4,
  },
  phaseBarText: {
    color: C.white,
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
  },
  phaseDesc: {
    fontSize: 8.5,
    lineHeight: 1.45,
    color: C.textMid,
    marginBottom: 5,
  },
  weekCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: 'solid',
    borderRadius: 3,
    marginBottom: 4,
    overflow: 'hidden',
  },
  weekSidebar: {
    backgroundColor: C.navy,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  weekLabel: {
    color: '#7FB3D8',
    fontSize: 5.5,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  weekNum: {
    color: C.white,
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
  weekDate: {
    color: '#B8CDE0',
    fontSize: 6,
    textAlign: 'center',
    marginTop: 2,
  },
  weekBody: {
    flex: 1,
    padding: 7,
  },
  weekTitle: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: C.navy,
    marginBottom: 2,
  },
  weekSession: {
    fontSize: 8,
    lineHeight: 1.45,
    color: C.textMid,
    marginBottom: 3,
  },
  weekTarget: {
    fontSize: 7.5,
    color: C.orange,
    fontFamily: 'Helvetica-Oblique',
    marginBottom: 3,
  },
  hwSection: {
    backgroundColor: C.offWhite,
    borderTopWidth: 1,
    borderTopColor: C.border,
    borderTopStyle: 'solid',
    padding: 5,
    marginTop: 2,
  },
  hwLabel: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: C.blue,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  hwItem: {
    fontSize: 7.5,
    color: C.textMid,
    lineHeight: 1.4,
  },
  phaseComplete: {
    fontSize: 8,
    fontFamily: 'Helvetica-Oblique',
    color: C.green,
    marginTop: 2,
    marginBottom: 6,
  },
  // ── Bottom line ─────────────────────────────────────────────────────────────
  bottomLine: {
    backgroundColor: C.navy,
    borderRadius: 4,
    padding: 14,
    marginTop: 14,
  },
  bottomLineTitle: {
    color: '#7FB3D8',
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
    marginBottom: 5,
  },
  bottomLineText: {
    color: C.white,
    fontSize: 10,
    lineHeight: 1.65,
    fontFamily: 'Helvetica-Bold',
  },
  // ── Footer ──────────────────────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 7,
    color: '#AABBCC',
  },
});

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionBar({ title }) {
  return (
    <View style={s.sectionBar}>
      <Text style={s.sectionBarText}>{title.toUpperCase()}</Text>
    </View>
  );
}

function PriorityBadge({ priority }) {
  // Strip any emoji or non-ASCII Claude may have added, then title-case for lookup
  const clean = (priority || '').replace(/[^\x00-\x7F]/g, '').trim();
  const key = clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
  const normalized = ['High','Medium','Low','Protect'].find(k => key.startsWith(k)) || 'Low';
  const style = PRIORITY_STYLES[normalized];
  return <Text style={[s.badge, style]}>{normalized}</Text>;
}

// ── Main document ─────────────────────────────────────────────────────────────

function GamePlanDocument({ data, studentName }) {
  return (
    <Document>
      <Page size="LETTER" style={s.page} wrap>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerBrand}>STUDYCORE  ·  SAT PREP GAME PLAN</Text>
          <Text style={s.headerName}>{studentName}</Text>
          {data.tagline ? <Text style={s.headerTagline}>{data.tagline}</Text> : null}
        </View>

        {/* Score Boxes */}
        <View style={s.scoreRow}>
          {Object.values(data.scoreBoxes || {}).map((box, i) => {
            const c = BOX_COLORS[i] || BOX_COLORS[0];
            return (
              <View key={i} style={[s.scoreBox, { backgroundColor: c.bg }]}>
                <Text style={[s.scoreBoxLabel, { color: c.label }]}>{(box.label || '').toUpperCase()}</Text>
                <Text style={[s.scoreBoxValue, { color: c.value }]}>{box.value || '—'}</Text>
                {box.subtitle ? <Text style={[s.scoreBoxSub, { color: c.sub }]}>{box.subtitle}</Text> : null}
              </View>
            );
          })}
        </View>

        {/* Callouts */}
        {data.mainCallout ? (
          <View style={s.calloutBlue}>
            <Text style={[s.calloutLabel, { color: C.blue }]}>{(data.mainCallout.title || '').toUpperCase()}</Text>
            <Text style={s.calloutBody}>{data.mainCallout.body}</Text>
          </View>
        ) : null}
        {data.bottleneckCallout ? (
          <View style={s.calloutOrange}>
            <Text style={[s.calloutLabel, { color: C.orange }]}>{(data.bottleneckCallout.title || '').toUpperCase()}</Text>
            <Text style={s.calloutBody}>{data.bottleneckCallout.body}</Text>
          </View>
        ) : null}

        {/* Score Analysis */}
        {data.scoreAnalysis ? (
          <>
            <SectionBar title="Score Analysis" />
            <Text style={s.body}>{data.scoreAnalysis}</Text>
          </>
        ) : null}

        {/* Domain Priority */}
        {data.domainPriority?.length > 0 ? (
          <>
            <SectionBar title="Domain Priority" />
            <View>
              <View style={s.tableHeaderRow}>
                <Text style={[s.tableHeaderCell, { flex: 2 }]}>Domain</Text>
                <Text style={s.tableHeaderCell}>Current</Text>
                <Text style={s.tableHeaderCell}>Target</Text>
                <Text style={s.tableHeaderCell}>Priority</Text>
              </View>
              {data.domainPriority.map((row, i) => (
                <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                  <Text style={[s.tableCell, { flex: 2, fontFamily: 'Helvetica-Bold' }]}>{row.domain}</Text>
                  <Text style={s.tableCell}>{row.performance}</Text>
                  <Text style={s.tableCell}>{row.target}</Text>
                  <View style={[s.tableCell, { justifyContent: 'center' }]}>
                    <PriorityBadge priority={row.priority} />
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* Program Overview */}
        {data.programOverview ? (
          <>
            <SectionBar title="Program Overview" />
            <View style={s.overviewGrid}>
              {Object.entries(data.programOverview).map(([key, val]) => (
                <View key={key} style={s.overviewItem}>
                  <Text style={s.overviewLabel}>{key.replace(/([A-Z])/g, ' $1').trim().toUpperCase()}</Text>
                  <Text style={s.overviewValue}>{val || '—'}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* Focus Areas */}
        {data.focusAreas?.length > 0 ? (
          <>
            <SectionBar title="Focus Areas" />
            <View style={s.focusGrid}>
              {data.focusAreas.map((area, i) => (
                <View key={i} style={s.focusCard}>
                  <Text style={s.focusNum}>{String(area.number || i + 1).padStart(2, '0')}</Text>
                  <Text style={s.focusTitle}>{area.title}</Text>
                  <Text style={s.focusBody}>{area.body}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* Week-by-Week */}
        {data.phases?.length > 0 ? (
          <>
            <SectionBar title="Week-by-Week Plan" />
            {data.weekByWeekIntro ? <Text style={[s.body, { marginBottom: 8 }]}>{data.weekByWeekIntro}</Text> : null}
            {data.phases.map((phase, pi) => (
              <View key={pi}>
                <View style={s.phaseBar}>
                  <Text style={s.phaseBarText}>{phase.title}</Text>
                </View>
                {phase.description ? <Text style={s.phaseDesc}>{phase.description}</Text> : null}
                {phase.weeks?.map((wk, wi) => (
                  <View key={wi} style={s.weekCard} wrap={false}>
                    <View style={s.weekSidebar}>
                      <Text style={s.weekLabel}>WK</Text>
                      <Text style={s.weekNum}>{wk.weekNum}</Text>
                      {wk.dateRange ? <Text style={s.weekDate}>{wk.dateRange}</Text> : null}
                    </View>
                    <View style={s.weekBody}>
                      {wk.title ? <Text style={s.weekTitle}>{wk.title}</Text> : null}
                      {wk.sessionContent ? <Text style={s.weekSession}>{wk.sessionContent}</Text> : null}
                      {wk.testTarget ? <Text style={s.weekTarget}>TARGET: {wk.testTarget}</Text> : null}
                      {wk.homework?.length > 0 ? (
                        <View style={s.hwSection}>
                          <Text style={s.hwLabel}>HOMEWORK</Text>
                          {wk.homework.map((hw, hi) => (
                            <Text key={hi} style={s.hwItem}>• {hw}</Text>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  </View>
                ))}
                {phase.phaseComplete ? <Text style={s.phaseComplete}>Done: {phase.phaseComplete}</Text> : null}
              </View>
            ))}
          </>
        ) : null}

        {/* Score Progression */}
        {data.scoreProgression?.rows?.length > 0 ? (
          <>
            <SectionBar title="Score Progression" />
            {data.scoreProgression.intro ? <Text style={[s.body, { marginBottom: 6 }]}>{data.scoreProgression.intro}</Text> : null}
            <View style={{ marginBottom: 6 }}>
              <View style={s.tableHeaderRow}>
                <Text style={[s.tableHeaderCell, { flex: 2 }]}>Milestone</Text>
                <Text style={s.tableHeaderCell}>Total</Text>
                <Text style={s.tableHeaderCell}>R/W</Text>
                <Text style={s.tableHeaderCell}>Math</Text>
              </View>
              {data.scoreProgression.rows.map((row, i) => (
                <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                  <Text style={[s.tableCell, { flex: 2 }]}>{row.milestone}</Text>
                  <Text style={[s.tableCell, { fontFamily: 'Helvetica-Bold' }]}>{row.total}</Text>
                  <Text style={s.tableCell}>{row.rw}</Text>
                  <Text style={s.tableCell}>{row.math}</Text>
                </View>
              ))}
            </View>
            {data.scoreProgression.note ? (
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Oblique', color: C.textLight, marginBottom: 6 }}>
                {data.scoreProgression.note}
              </Text>
            ) : null}
          </>
        ) : null}

        {/* Bottom Line */}
        {data.bottomLine ? (
          <View style={s.bottomLine}>
            <Text style={s.bottomLineTitle}>THE BOTTOM LINE</Text>
            <Text style={s.bottomLineText}>{data.bottomLine}</Text>
          </View>
        ) : null}

        {/* Footer (fixed on every page) */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>StudyCore  ·  {studentName}  ·  SAT Prep Game Plan  ·  Confidential</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

      </Page>
    </Document>
  );
}

// ─── Practice test helpers ────────────────────────────────────────────────────

function buildPracticeTestsOverviewText(practiceTests, isACT) {
  if (!practiceTests || practiceTests.length === 0) return '—';
  const testName = isACT ? 'ACT' : 'SAT';
  const weeks = practiceTests.map(pt => `Week ${pt.week}`).join(', ');
  return `${practiceTests.length} full-length ${testName} practice tests — ${weeks}`;
}

function buildScoreProgressionRows(practiceTests, studentData) {
  const isACT = (studentData?.testType || '').toUpperCase() === 'ACT';
  const rows = [];

  // Baseline row
  const baselineTotal = studentData?.totalScore ? String(studentData.totalScore) : '—';
  const baselineRW    = isACT ? '' : (studentData?.rwScore   ? String(studentData.rwScore)   : '—');
  const baselineMath  = isACT ? '' : (studentData?.mathScore ? String(studentData.mathScore) : '—');
  rows.push({ milestone: 'Baseline', total: baselineTotal, rw: baselineRW, math: baselineMath, indicator: '—' });

  // One row per practice test
  for (const pt of (practiceTests || [])) {
    rows.push({
      milestone: `Practice Test ${pt.testNumber} (Week ${pt.week})`,
      total:     pt.targetTotal || '—',
      rw:        isACT ? '' : (pt.targetRW   || '—'),
      math:      isACT ? '' : (pt.targetMath || '—'),
      indicator: 'o',  // ○ (U+25CB) not in Windows-1252 — use lowercase o
    });
  }

  // Target row — ★ (U+2605) not in Windows-1252 — use asterisk
  const targetTotal = studentData?.targetScore ? String(studentData.targetScore) : '—';
  rows.push({ milestone: 'Target', total: targetTotal, rw: '', math: '', indicator: '*' });

  return rows;
}

export async function buildGamePlanPdf(data, studentData, studentName) {

  const isACT = (studentData?.testType || '').toUpperCase() === 'ACT';

  // Inject computed practice test text into programOverview (Claude no longer writes this)
  const practiceTestsText = buildPracticeTestsOverviewText(data.practiceTests, isACT);
  const enrichedData = {
    ...data,
    programOverview: data.programOverview
      ? { ...data.programOverview, practiceTests: practiceTestsText }
      : { practiceTests: practiceTestsText },
    // Build score progression rows from the canonical practiceTests array
    scoreProgression: {
      ...(data.scoreProgression || {}),
      rows: buildScoreProgressionRows(data.practiceTests, studentData),
    },
  };

  const element = React.createElement(GamePlanDocument, { data: enrichedData, studentName: studentName || 'Student' });
  return await renderToBuffer(element);
}
