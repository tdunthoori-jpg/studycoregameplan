import React from 'react';
import {
  Document, Page, Text, View,
  Svg, Line, Polyline, Circle, Rect,
  renderToBuffer,
} from '@react-pdf/renderer';

// ── Color palette (exact from spec) ─────────────────────────────────────────
const C = {
  navy900:  '#0F1B3D',
  navy700:  '#1E2D5F',
  navy500:  '#2D4A8A',
  coral500: '#FF6B5A',
  coral400: '#FF8A7A',
  coral100: '#FFE5E0',
  navy100:  '#EEF1F8',
  gray700:  '#475569',
  gray500:  '#94A3B8',
  gray200:  '#E5E7EB',
  white:    '#FFFFFF',
  green500: '#10B981',
};

// Page dimensions: 1440×810 (75% of spec 1920×1080) for reliable PDF rendering
const PW = 1440;
const PH = 810;
const HEADER_H = 45;
const FOOTER_H = 30;
const M = 60; // outer margin

// Font shorthand
const Hv = 'Helvetica';
const HvB = 'Helvetica-Bold';
const HvO = 'Helvetica-Oblique';
const HvBO = 'Helvetica-BoldOblique';

// ── Shared text styles ────────────────────────────────────────────────────────
const T = {
  header: { fontSize: 22, fontFamily: HvB, color: C.navy900 },
  subtitle: { fontSize: 14, fontFamily: HvO, color: C.coral500, marginBottom: 20 },
  hero: { fontSize: 64, fontFamily: HvB, color: C.navy900, lineHeight: 1 },
  statLg: { fontSize: 44, fontFamily: HvB, color: C.coral500, lineHeight: 1 },
  statMd: { fontSize: 30, fontFamily: HvB, color: C.navy900, lineHeight: 1 },
  cardTitle: { fontSize: 9, fontFamily: HvB, color: C.coral500, letterSpacing: 1 },
  cardBody: { fontSize: 11, color: C.gray700, lineHeight: 1.5 },
  tagline: { fontSize: 13, fontFamily: HvB, color: C.navy900 },
  taglineSub: { fontSize: 10, fontFamily: HvO, color: C.gray700 },
  brand: { fontSize: 8, fontFamily: HvB, color: C.gray500, letterSpacing: 1 },
  footer: { fontSize: 8, color: C.gray500 },
};

// ── Derive all presentation data from gamePlan + studentData ─────────────────
function derive(gamePlan, studentData, studentName) {
  const {
    rwScore, mathScore, targetScore, testType, targetTestDate,
    weeks, totalHours, targetColleges,
  } = studentData;

  const rwCur  = parseInt(rwScore)    || 0;
  const mathCur = parseInt(mathScore) || 0;
  const baseline = rwCur + mathCur;
  const target   = parseInt(targetScore) || 1400;

  // Section analysis
  const weakIsRW   = rwCur < mathCur;
  const weakSec    = weakIsRW ? 'R/W'  : 'Math';
  const strongSec  = weakIsRW ? 'Math' : 'R/W';
  const weakScore  = weakIsRW ? rwCur  : mathCur;
  const strongScore = weakIsRW ? mathCur : rwCur;

  // One-line thesis
  const gap = Math.abs(rwCur - mathCur);
  let thesis;
  if (weakIsRW) {
    if (mathCur >= 700)  thesis = 'Math is elite. R/W is the entire gap.';
    else if (gap >= 80)  thesis = 'Math is strong. R/W is the climb.';
    else                 thesis = 'Solid baseline. The lift lives in R/W.';
  } else {
    if (rwCur >= 700)    thesis = 'R/W is strong. Math is the climb.';
    else if (gap >= 80)  thesis = 'R/W is solid. Math is the gap.';
    else                 thesis = 'Solid baseline. The lift lives in Math.';
  }

  // Score band
  const cols = (targetColleges || '').toLowerCase();
  let scoreBand;
  if (/mit|caltech|cmu|georgia.?tech/.test(cols)) scoreBand = 'STEM-tier';
  else if (/harvard|yale|princeton|stanford|columbia|dartmouth|brown|cornell|upenn/.test(cols)) scoreBand = 'Ivy-tier';
  else if (target >= 1500) scoreBand = 'elite-tier';
  else if (target >= 1450) scoreBand = 'T20-tier';
  else if (target >= 1350) scoreBand = 'strong-tier';
  else if (target >= 1250) scoreBand = 'solid-tier';
  else                     scoreBand = `${target}+ target`;

  // Targets from last scoreProgression row
  const progRows = gamePlan.scoreProgression?.rows || [];
  const lastRow  = progRows[progRows.length - 1] || {};
  const rwTargetStr   = lastRow.rw   || `${Math.round(target * 0.47)}+`;
  const mathTargetStr = lastRow.math || `${Math.round(target * 0.53)}+`;

  // Lifts
  const totalLift  = target - baseline;
  const weakLift   = Math.round(totalLift * 0.87);
  const strongLift = totalLift - weakLift;

  // Percentile helper
  function pct(s) {
    const table = [
      [780,'99th'],[750,'99th'],[720,'97th'],[700,'95th'],[680,'93rd'],
      [660,'90th'],[640,'87th'],[620,'83rd'],[600,'79th'],[580,'74th'],
      [560,'69th'],[540,'63rd'],[520,'57th'],[500,'50th'],[480,'43rd'],
      [460,'37th'],[420,'24th'],
    ];
    for (const [t, p] of table) if (s >= t) return p;
    return '15th';
  }
  const baselinePct = pct(baseline);
  const rwPct       = pct(rwCur);
  const mathPct     = pct(mathCur);

  // Date strings
  let testMonthYear = 'Target Date';
  let testMonth     = 'Target';
  if (targetTestDate) {
    const d = new Date(targetTestDate + 'T12:00:00');
    testMonthYear = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    testMonth     = d.toLocaleDateString('en-US', { month: 'long' });
  }
  const baselineLabel = (testType === 'PSAT' || testType === 'PSAT/NMSQT' || testType === 'PSAT 10')
    ? 'PSAT' : (testType || 'SAT');

  // Parse phases
  const phases = gamePlan.phases || [];
  const parsedPhases = phases.map(ph => {
    const hMatch  = (ph.title || '').match(/(\d+)\s*hrs?/i);
    const wkMatch = (ph.title || '').match(/[Ww]eeks?\s*(\d+)\s*[–\-]\s*(\d+)/i);
    const hours   = hMatch ? parseInt(hMatch[1]) : 0;
    const wkStart = wkMatch ? parseInt(wkMatch[1]) : null;
    const wkEnd   = wkMatch ? parseInt(wkMatch[2]) : wkStart;

    const txt = ((ph.title || '') + ' ' + (ph.description || '') + ' ' +
      (ph.weeks?.map(w => w.sessionContent || '').join(' ') || '')).toLowerCase();
    const rwKw   = ['r/w','reading','writing','sec','c&s','craft','structure','info','expression','eoi','i&i','conventions'];
    const mathKw = ['math','algebra','advanced math','psda','geometry','trig','quadratic','function'];
    const rwC    = rwKw.filter(k => txt.includes(k)).length;
    const mathC  = mathKw.filter(k => txt.includes(k)).length;
    const focus  = rwC > mathC ? 'rw' : mathC > rwC ? 'math' : 'mixed';

    let season = 'School Year';
    if (txt.includes('summer')) season = 'Summer';
    else if (txt.includes('peak') || txt.includes('sprint') || txt.includes('final') || txt.includes('dress rehearsal')) season = 'Final Sprint';

    const namePart = ph.title?.split('—')[1]?.split('|')[0]?.trim() || ph.title || '';
    return { ...ph, hours, wkStart, wkEnd, focus, season, shortName: namePart };
  });

  const phaseCount = parsedPhases.length;
  const totalHrs   = parseInt(totalHours) || 20;

  // Time allocation
  let rwH = 0, mathH = 0;
  parsedPhases.forEach(ph => {
    if (ph.focus === 'rw')        rwH   += ph.hours;
    else if (ph.focus === 'math') mathH += ph.hours;
    else { rwH += ph.hours * 0.5; mathH += ph.hours * 0.5; }
  });
  const stratH   = Math.max(1, totalHrs - Math.round(rwH) - Math.round(mathH));
  const rwAlloc  = Math.max(1, totalHrs - Math.round(mathH) - stratH);
  const mathAlloc = Math.round(mathH);
  const rwAllocPct   = Math.round((rwAlloc  / totalHrs) * 100);
  const mathAllocPct = Math.round((mathAlloc / totalHrs) * 100);
  const stratAllocPct = 100 - rwAllocPct - mathAllocPct;

  // Conditional slides
  const showTimeAlloc = Math.max(rwAllocPct, mathAllocPct) >= 65;
  const hasSchoolYear = parsedPhases.some(ph => ph.season === 'School Year');
  const hasSummer     = parsedPhases.some(ph => ph.season === 'Summer');
  const showTwoGears  = hasSchoolYear && hasSummer;
  const expandPhases  = phaseCount >= 5;

  // Practice test rows (exclude baseline)
  const testRows = progRows.filter(r => {
    const m = (r.milestone || '').toLowerCase();
    return (m.includes('test') || m.includes('practice') || m.includes('wk')) &&
      !m.includes('baseline') && !m.includes('current') && !m.includes('psat');
  });
  const testCount = testRows.length || Math.max(3, Math.round(parseInt(weeks) / 3));

  // Chart data points
  function parseFirstNum(str) {
    const m = (str || '').match(/(\d{3,4})/); return m ? parseInt(m[1]) : null;
  }
  const chartPoints = [{ label: baselineLabel, score: baseline, isPSAT: true }];
  if (testRows.length > 0) {
    testRows.forEach((r, i) => {
      const s = parseFirstNum(r.total) || Math.round(baseline + (target - baseline) * ((i + 1) / (testRows.length + 1)));
      chartPoints.push({ label: `T#${i + 1}`, score: s, milestone: r.milestone || '' });
    });
  } else {
    for (let i = 1; i <= testCount; i++) {
      const prog = i / (testCount + 1);
      chartPoints.push({ label: `T#${i}`, score: Math.round(baseline + (target - baseline) * Math.pow(prog, 0.75)) });
    }
  }
  chartPoints.push({ label: testMonth, score: target, isTarget: true });

  // Checkpoint job descriptions
  const checkJobs = testRows.map((r, i) => {
    const n = testRows.length;
    if (i === 0)         return 'True SAT baseline';
    if (i === n - 1)     return 'Dress rehearsal';
    if (i === n - 2)     return 'Target in range';
    if (i === 1 && n > 3) return 'First domain moving';
    if (i === Math.floor(n / 2)) return 'Midpoint check';
    return 'Progress check';
  });
  // Fallback if no test rows
  const fallbackJobs = ['True SAT baseline','Movement check','Summer lift begins','Target in range','Ceiling tapped','Dress rehearsal'];

  // Two-gears cadence
  const syPhases  = parsedPhases.filter(ph => ph.season === 'School Year');
  const sumPhases = parsedPhases.filter(ph => ph.season === 'Summer' || ph.season === 'Final Sprint');
  const syHrs  = syPhases.reduce((s, ph) => s + ph.hours, 0);
  const sumHrs = sumPhases.reduce((s, ph) => s + ph.hours, 0);
  const syWkStart  = syPhases[0]?.wkStart || 1;
  const syWkEnd    = syPhases[syPhases.length - 1]?.wkEnd || 8;
  const sumWkStart = sumPhases[0]?.wkStart || 9;
  const sumWkEnd   = sumPhases[sumPhases.length - 1]?.wkEnd || parseInt(weeks) || 18;

  // Total slide count
  let totalSlides = 10;
  if (showTimeAlloc) totalSlides++;
  if (showTwoGears)  totalSlides++;
  if (expandPhases)  totalSlides++;

  const firstName = (studentName || '').split(' ')[0] || 'Student';

  return {
    firstName, studentName,
    baseline, rwCur, mathCur, target,
    rwTargetStr, mathTargetStr,
    testType, testMonthYear, testMonth, baselineLabel,
    weeks: parseInt(weeks) || 0,
    totalHours: totalHrs,
    weakIsRW, weakSec, strongSec,
    weakScore, strongScore,
    totalLift, weakLift, strongLift,
    thesis, scoreBand,
    baselinePct, rwPct, mathPct,
    parsedPhases, phaseCount, testRows, testCount, checkJobs, fallbackJobs,
    rwAlloc, mathAlloc, stratH, rwAllocPct, mathAllocPct, stratAllocPct,
    showTimeAlloc, showTwoGears, expandPhases,
    totalSlides,
    syPhases, sumPhases, syHrs, sumHrs, syWkStart, syWkEnd, sumWkStart, sumWkEnd,
    chartPoints, progRows,
    cols: targetColleges || '',
  };
}

// ── Shared layout components ──────────────────────────────────────────────────

function BrandHeader({ firstName, cat }) {
  return (
    <View style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: HEADER_H,
      borderBottomWidth: 1, borderBottomColor: C.gray200,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: M,
    }}>
      <Text style={[T.brand, { color: C.coral500 }]}>STUDYCORE</Text>
      <Text style={T.brand}>{firstName}'s SAT Game Plan | Demo Presentation</Text>
      <Text style={T.brand}>{cat}</Text>
    </View>
  );
}

function SlideFooter({ n, total }) {
  return (
    <View style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, height: FOOTER_H,
      borderTopWidth: 1, borderTopColor: C.gray200,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: M,
    }}>
      <Text style={T.footer}>StudyCore SAT Prep — Confidential</Text>
      <Text style={T.footer}>Slide {n} of {total}</Text>
    </View>
  );
}

// Content wrapper — sits between header and footer with side margins
function Content({ children, justify = 'center', pt = 0 }) {
  return (
    <View style={{
      marginTop: HEADER_H + 8,
      marginBottom: FOOTER_H + 8,
      marginHorizontal: M,
      flex: 1,
      justifyContent: justify,
      paddingTop: pt,
    }}>
      {children}
    </View>
  );
}

// Reusable card variants
function StatBox({ label, value, sub, style }) {
  return (
    <View style={[{ backgroundColor: C.navy100, borderRadius: 12, padding: 20 }, style]}>
      <Text style={T.cardTitle}>{label}</Text>
      <Text style={T.statLg}>{value}</Text>
      {sub ? <Text style={[T.cardBody, { marginTop: 6, fontSize: 10 }]}>{sub}</Text> : null}
    </View>
  );
}

function PhaseCard({ phase, style }) {
  const desc = (phase.description || '').slice(0, 180);
  const wkLabel = phase.wkStart && phase.wkEnd ? `Wks ${phase.wkStart}–${phase.wkEnd}` :
    phase.wkStart ? `Wk ${phase.wkStart}` : '';
  return (
    <View style={[{
      backgroundColor: C.white,
      borderWidth: 1.5,
      borderColor: C.coral100,
      borderLeftWidth: 5,
      borderLeftColor: C.coral500,
      borderRadius: 10,
      padding: 18,
    }, style]}>
      <Text style={T.cardTitle}>{phase.shortName || phase.title}</Text>
      <Text style={{ fontSize: 10, fontFamily: HvB, color: C.navy700, marginBottom: 6 }}>
        {[wkLabel, phase.hours ? `${phase.hours} hrs` : '', phase.season].filter(Boolean).join('  ·  ')}
      </Text>
      <Text style={T.cardBody}>{desc}</Text>
    </View>
  );
}

// ── SLIDE 1: Cover ──────────────────────────────────────────────────────────
function Slide1({ d, n }) {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const familyName = (d.studentName || '').split(' ').slice(1).join(' ') || d.firstName;
  return (
    <Page size={[PW, PH]}>
      <BrandHeader firstName={d.firstName} cat="COVER" />
      <Content justify="flex-start" pt={12}>
        {/* Title + thesis */}
        <Text style={{ fontSize: 32, fontFamily: HvB, color: C.navy900, marginBottom: 4 }}>
          {d.firstName}'s SAT Game Plan
        </Text>
        <Text style={T.subtitle}>{d.thesis}</Text>
        <Text style={{ fontSize: 9, color: C.gray500, marginBottom: 16 }}>
          PREPARED FOR: {familyName || d.firstName} &amp; Family  ·  Plan Created: {today}  ·  Target: {d.testMonthYear} SAT
        </Text>

        {/* The Climb panel */}
        <View style={{
          backgroundColor: C.navy900, borderRadius: 14, padding: 24,
          flexDirection: 'row', alignItems: 'center', marginBottom: 14,
        }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 52, fontFamily: HvB, color: C.white, lineHeight: 1 }}>{d.baseline}</Text>
            <Text style={{ fontSize: 9, color: C.gray500, marginTop: 6 }}>{d.baselineLabel} · No structured prep</Text>
            <Text style={{ fontSize: 9, color: C.gray500 }}>{d.baselinePct} percentile</Text>
          </View>
          <View style={{ paddingHorizontal: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 28, color: C.coral500 }}>→</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 52, fontFamily: HvB, color: C.coral400, lineHeight: 1 }}>{d.target}+</Text>
            <Text style={{ fontSize: 9, color: C.gray500, marginTop: 6, textAlign: 'right' }}>{d.testMonthYear} SAT</Text>
            <Text style={{ fontSize: 9, color: C.coral400, textAlign: 'right' }}>{d.scoreBand}</Text>
          </View>
        </View>

        {/* Three lift boxes */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
          <View style={{ flex: 1, backgroundColor: C.navy100, borderRadius: 10, padding: 16 }}>
            <Text style={T.cardTitle}>TOTAL LIFT</Text>
            <Text style={{ fontSize: 36, fontFamily: HvB, color: C.coral500, lineHeight: 1 }}>+{d.totalLift}</Text>
            <Text style={{ fontSize: 10, color: C.gray700, marginTop: 4 }}>{d.baseline} → {d.target}+</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: C.coral100, borderRadius: 10, padding: 16 }}>
            <Text style={T.cardTitle}>{d.weakSec} GAP</Text>
            <Text style={{ fontSize: 36, fontFamily: HvB, color: C.coral500, lineHeight: 1 }}>+{d.weakLift}</Text>
            <Text style={{ fontSize: 10, color: C.gray700, marginTop: 4 }}>
              {d.weakScore} → {d.weakIsRW ? d.rwTargetStr : d.mathTargetStr}
            </Text>
            <Text style={{ fontSize: 9, fontFamily: HvO, color: C.gray500 }}>(the climb)</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: C.navy100, borderRadius: 10, padding: 16 }}>
            <Text style={T.cardTitle}>{d.strongSec} POLISH</Text>
            <Text style={{ fontSize: 36, fontFamily: HvB, color: C.coral500, lineHeight: 1 }}>+{d.strongLift}</Text>
            <Text style={{ fontSize: 10, color: C.gray700, marginTop: 4 }}>
              {d.strongScore} → {d.weakIsRW ? d.mathTargetStr : d.rwTargetStr}
            </Text>
            <Text style={{ fontSize: 9, fontFamily: HvO, color: C.gray500 }}>(already strong)</Text>
          </View>
        </View>

        {/* Footer stat strip */}
        <View style={{
          backgroundColor: C.navy100, borderRadius: 8, padding: 12,
          flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
        }}>
          {[
            `${d.weeks} WEEKS`, `${d.totalHours} HOURS`, `${d.phaseCount} PHASES`, `${d.testCount} PRACTICE TESTS`,
          ].map((label, i, arr) => (
            <React.Fragment key={label}>
              <Text style={{ fontSize: 11, fontFamily: HvB, color: C.navy900 }}>{label}</Text>
              {i < arr.length - 1 && <Text style={{ fontSize: 11, color: C.gray500 }}>·</Text>}
            </React.Fragment>
          ))}
        </View>

        <Text style={[T.taglineSub, { marginTop: 10 }]}>
          Built around the {d.testMonth} SAT — engineered to lift {d.weakSec} and protect {d.strongSec}.
        </Text>
      </Content>
      <SlideFooter n={n} total={d.totalSlides} />
    </Page>
  );
}

// ── SLIDE 2: Where They Stand ──────────────────────────────────────────────
function Slide2({ d, n }) {
  const rwRead  = d.rwCur  >= 700 ? 'At the ceiling' : d.rwCur  >= 650 ? 'Strong — nearly there' : d.rwCur >= 600 ? 'Solid foundation' : d.rwCur >= 550 ? 'Building room' : 'Largest opportunity';
  const mathRead = d.mathCur >= 700 ? 'At the ceiling' : d.mathCur >= 650 ? 'Strong — nearly there' : d.mathCur >= 600 ? 'Solid foundation' : d.mathCur >= 550 ? 'Building room' : 'Largest opportunity';
  return (
    <Page size={[PW, PH]}>
      <BrandHeader firstName={d.firstName} cat="STARTING POINT" />
      <Content>
        <Text style={T.header}>WHERE {d.firstName.toUpperCase()} STANDS TODAY</Text>
        <Text style={T.subtitle}>{d.baseline}. With zero structured prep.</Text>

        {/* Hero score */}
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <Text style={{ fontSize: 96, fontFamily: HvB, color: C.navy900, lineHeight: 1 }}>{d.baseline}</Text>
          <Text style={{ fontSize: 12, color: C.gray700, marginTop: 6 }}>
            {d.baselineLabel} · {d.testType?.includes('PSAT') ? 'October 2025' : 'No structured prep'}
          </Text>
          <Text style={{ fontSize: 11, fontFamily: HvB, color: C.coral500, marginTop: 4 }}>
            {d.baselinePct.toUpperCase()} PERCENTILE NATIONALLY
          </Text>
        </View>

        {/* Two section cards */}
        <View style={{ flexDirection: 'row', gap: 20 }}>
          <View style={{ flex: 1, backgroundColor: d.weakIsRW ? C.coral100 : C.navy100, borderRadius: 12, padding: 24 }}>
            <Text style={T.cardTitle}>MATH</Text>
            <Text style={T.statMd}>{d.mathCur}</Text>
            <Text style={{ fontSize: 11, color: C.gray700, marginTop: 6 }}>{d.mathPct} percentile</Text>
            <Text style={[T.cardBody, { marginTop: 4 }]}>{mathRead}</Text>
            {!d.weakIsRW && (
              <Text style={{ fontSize: 10, fontFamily: HvO, color: C.coral500, marginTop: 6 }}>
                {d.mathCur - d.rwCur} points ahead of R/W
              </Text>
            )}
          </View>
          <View style={{ flex: 1, backgroundColor: d.weakIsRW ? C.navy100 : C.coral100, borderRadius: 12, padding: 24 }}>
            <Text style={T.cardTitle}>READING &amp; WRITING</Text>
            <Text style={T.statMd}>{d.rwCur}</Text>
            <Text style={{ fontSize: 11, color: C.gray700, marginTop: 6 }}>{d.rwPct} percentile</Text>
            <Text style={[T.cardBody, { marginTop: 4 }]}>{rwRead}</Text>
            {d.weakIsRW && (
              <Text style={{ fontSize: 10, fontFamily: HvO, color: C.coral500, marginTop: 6 }}>
                {d.mathCur - d.rwCur} points behind Math
              </Text>
            )}
          </View>
        </View>
      </Content>
      <SlideFooter n={n} total={d.totalSlides} />
    </Page>
  );
}

// ── SLIDE 3: Diagnosis ────────────────────────────────────────────────────
function Slide3({ d, n }) {
  const weakTarget  = d.weakIsRW  ? d.rwTargetStr   : d.mathTargetStr;
  const strongTarget = d.weakIsRW ? d.mathTargetStr  : d.rwTargetStr;
  return (
    <Page size={[PW, PH]}>
      <BrandHeader firstName={d.firstName} cat="DIAGNOSIS" />
      <Content>
        <Text style={T.header}>THE DIAGNOSIS</Text>
        <Text style={T.subtitle}>{d.thesis}</Text>

        {/* Top two cards */}
        <View style={{ flexDirection: 'row', gap: 20, marginBottom: 14 }}>
          <View style={{ flex: 1, backgroundColor: C.navy100, borderRadius: 12, padding: 20 }}>
            <Text style={T.cardTitle}>{d.strongSec}</Text>
            <Text style={{ fontSize: 10, color: C.gray500, marginBottom: 8 }}>Already strong</Text>
            <Text style={T.statMd}>{d.strongScore}</Text>
            <Text style={{ fontSize: 10, color: C.gray700, marginTop: 6 }}>
              {d.strongScore} → {strongTarget}
            </Text>
            <Text style={{ fontSize: 10, fontFamily: HvB, color: C.green500, marginTop: 4 }}>Maintain &amp; polish</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: C.coral100, borderRadius: 12, padding: 20 }}>
            <Text style={T.cardTitle}>{d.weakSec}</Text>
            <Text style={{ fontSize: 10, color: C.gray500, marginBottom: 8 }}>
              {d.weakIsRW ? d.rwPct : d.mathPct} percentile — the gap
            </Text>
            <Text style={T.statMd}>{d.weakScore}</Text>
            <Text style={{ fontSize: 10, color: C.gray700, marginTop: 6 }}>
              {d.weakLift} points to close
            </Text>
            <Text style={{ fontSize: 10, fontFamily: HvB, color: C.coral500, marginTop: 4 }}>Primary focus</Text>
          </View>
        </View>

        {/* Large bottom card */}
        <View style={{
          backgroundColor: C.navy900, borderRadius: 12, padding: 24,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 14,
        }}>
          <View>
            <Text style={{ fontSize: 9, fontFamily: HvB, color: C.gray500, marginBottom: 4 }}>TARGET {d.weakSec.toUpperCase()}</Text>
            <Text style={{ fontSize: 44, fontFamily: HvB, color: C.coral400, lineHeight: 1 }}>{weakTarget}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 9, color: C.gray500 }}>from {d.weakScore}</Text>
            <Text style={{ fontSize: 28, fontFamily: HvB, color: C.white }}>+{d.weakLift} needed</Text>
          </View>
        </View>

        <Text style={T.tagline}>
          Every point of the climb to {d.target}+ lives on the {d.weakSec} side.
        </Text>
        <Text style={T.taglineSub}>
          {d.strongSec} gets maintenance. {d.weakSec} gets the focus.
        </Text>
      </Content>
      <SlideFooter n={n} total={d.totalSlides} />
    </Page>
  );
}

// ── SLIDE 4: What Admissions Sees ─────────────────────────────────────────
function Slide4({ d, n }) {
  const strongHighPct = d.weakIsRW ? d.mathPct : d.rwPct;
  const weakTarget    = d.weakIsRW ? d.rwTargetStr : d.mathTargetStr;
  const isSTEM = d.scoreBand === 'STEM-tier';

  const strongCardBody = isSTEM && d.strongSec === 'Math'
    ? `Table stakes for top STEM programs. Already assumed. Doesn't differentiate the application.`
    : `Strong foundation for any selective program. Already assumed in the profile. Doesn't differentiate on its own.`;

  const weakCardBody = isSTEM && d.weakSec === 'R/W'
    ? `The score they actually look at. Signals ${d.firstName} can read, write, and communicate technical material.`
    : d.weakSec === 'Math'
    ? `Signals quantitative aptitude. At top programs, Math performance is the analytical marker they focus on.`
    : `Demonstrates command of evidence-based reading and writing — what selective programs assume at the composite level.`;

  const callout = `Lifting ${d.weakSec} removes the only flag on a ${d.strongSec}-strong application profile.`;
  const sub = `${d.target}+ with ${d.strongScore}+ ${d.strongSec} = ${d.scoreBand}. ${d.strongSec} elite, ${d.weakSec} proven.`;

  return (
    <Page size={[PW, PH]}>
      <BrandHeader firstName={d.firstName} cat="WHY THIS MATTERS" />
      <Content>
        <Text style={T.header}>WHAT ADMISSIONS ACTUALLY SEES</Text>
        <Text style={T.subtitle}>At {d.target}+, {d.weakSec} becomes the score that matters.</Text>

        <View style={{ flexDirection: 'row', gap: 20, marginBottom: 16 }}>
          <View style={{ flex: 1, backgroundColor: C.navy100, borderRadius: 12, padding: 24 }}>
            <Text style={T.cardTitle}>{d.strongSec} AT {strongHighPct.toUpperCase()}</Text>
            <Text style={{ fontSize: 22, fontFamily: HvB, color: C.navy900, marginBottom: 12 }}>{d.strongScore}</Text>
            <Text style={T.cardBody}>{strongCardBody}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: C.coral100, borderRadius: 12, padding: 24 }}>
            <Text style={T.cardTitle}>{d.weakSec} AT {weakTarget}</Text>
            <Text style={{ fontSize: 22, fontFamily: HvB, color: C.navy900, marginBottom: 12 }}>{weakTarget}</Text>
            <Text style={T.cardBody}>{weakCardBody}</Text>
          </View>
        </View>

        {/* Callout */}
        <View style={{ backgroundColor: C.navy900, borderRadius: 10, padding: 20 }}>
          <Text style={{ fontSize: 14, fontFamily: HvB, color: C.white, marginBottom: 6 }}>{callout}</Text>
          <Text style={{ fontSize: 11, fontFamily: HvO, color: C.gray500 }}>{sub}</Text>
        </View>
      </Content>
      <SlideFooter n={n} total={d.totalSlides} />
    </Page>
  );
}

// ── SLIDE 5: Plan Overview ────────────────────────────────────────────────
function Slide5({ d, n }) {
  const boxes = [
    { label: 'WEEKS', value: String(d.weeks), sub: `Through ${d.testMonth} SAT` },
    { label: 'TOTAL HOURS', value: String(d.totalHours), sub: 'Instruction time' },
    { label: 'PHASES', value: String(d.phaseCount), sub: 'Each with a clear job' },
    { label: 'PRACTICE TESTS', value: String(d.testCount), sub: 'Tracking the climb' },
  ];
  const rwTarget   = d.weakIsRW ? d.rwTargetStr   : d.mathTargetStr;
  const mathTarget = d.weakIsRW ? d.mathTargetStr  : d.rwTargetStr;
  return (
    <Page size={[PW, PH]}>
      <BrandHeader firstName={d.firstName} cat="THE PLAN" />
      <Content>
        <Text style={T.header}>BUILT AROUND THE {d.testMonth.toUpperCase()} SAT</Text>
        <Text style={T.subtitle}>{d.weeks} weeks. {d.totalHours} hours. {d.phaseCount} phases.</Text>

        <View style={{ flexDirection: 'row', gap: 14, marginBottom: 20 }}>
          {boxes.map(box => (
            <View key={box.label} style={{ flex: 1, backgroundColor: C.navy100, borderRadius: 12, padding: 20 }}>
              <Text style={T.cardTitle}>{box.label}</Text>
              <Text style={T.statLg}>{box.value}</Text>
              <Text style={{ fontSize: 10, color: C.gray700, marginTop: 8 }}>{box.sub}</Text>
            </View>
          ))}
        </View>

        {/* Target footer bar */}
        <View style={{
          backgroundColor: C.navy900, borderRadius: 10, padding: 16,
          flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
        }}>
          <Text style={{ fontSize: 10, fontFamily: HvB, color: C.gray500 }}>TARGET</Text>
          <Text style={{ fontSize: 12, fontFamily: HvB, color: C.white }}>{d.testMonthYear} SAT</Text>
          <Text style={{ fontSize: 10, color: C.gray500 }}>·</Text>
          <Text style={{ fontSize: 12, fontFamily: HvB, color: C.coral400 }}>{d.target}+</Text>
          <Text style={{ fontSize: 10, color: C.gray500 }}>·</Text>
          <Text style={{ fontSize: 12, color: C.white }}>R/W {d.rwTargetStr}</Text>
          <Text style={{ fontSize: 10, color: C.gray500 }}>·</Text>
          <Text style={{ fontSize: 12, color: C.white }}>Math {d.mathTargetStr}</Text>
        </View>
      </Content>
      <SlideFooter n={n} total={d.totalSlides} />
    </Page>
  );
}

// ── SLIDE 6: Time Allocation (conditional) ────────────────────────────────
function Slide6TimeAlloc({ d, n }) {
  const dominantSec = d.rwAllocPct >= d.mathAllocPct ? 'R/W' : 'Math';
  const dominantPct = Math.max(d.rwAllocPct, d.mathAllocPct);
  const totalW = PW - M * 2; // content width for bars

  function Bar({ label, pct, hours, detail, color }) {
    const filled = Math.round((pct / 100) * (totalW - 80));
    return (
      <View style={{ marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ fontSize: 10, fontFamily: HvB, color: C.navy900 }}>{pct}% {label}</Text>
          <Text style={{ fontSize: 10, color: C.gray700 }}>{hours} hrs</Text>
        </View>
        <View style={{ height: 18, backgroundColor: C.gray200, borderRadius: 9 }}>
          <View style={{ width: filled, height: 18, backgroundColor: color, borderRadius: 9 }} />
        </View>
        <Text style={{ fontSize: 10, color: C.gray700, marginTop: 4, fontFamily: HvO }}>{detail}</Text>
      </View>
    );
  }

  return (
    <Page size={[PW, PH]}>
      <BrandHeader firstName={d.firstName} cat="WHERE THE TIME GOES" />
      <Content>
        <Text style={T.header}>TIME FOLLOWS THE POINTS</Text>
        <Text style={T.subtitle}>{dominantPct}% of instruction time goes to {dominantSec}.</Text>

        {/* Hero total */}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 24 }}>
          <Text style={{ fontSize: 56, fontFamily: HvB, color: C.coral500 }}>{d.totalHours}</Text>
          <Text style={{ fontSize: 16, color: C.gray700, marginLeft: 8 }}>hrs total program</Text>
        </View>

        <Bar
          label="READING &amp; WRITING"
          pct={d.rwAllocPct}
          hours={d.rwAlloc}
          detail="SEC, Information &amp; Ideas, Craft &amp; Structure — the highest-leverage domains"
          color={d.weakIsRW ? C.coral500 : C.navy700}
        />
        <Bar
          label="MATH"
          pct={d.mathAllocPct}
          hours={d.mathAlloc}
          detail={d.weakIsRW ? 'PSDA polish + hardest-item drilling' : 'Algebra, Advanced Math, PSDA, Geometry'}
          color={d.weakIsRW ? C.navy700 : C.coral500}
        />
        <Bar
          label="STRATEGY &amp; TESTING"
          pct={d.stratAllocPct}
          hours={d.stratH}
          detail="Pacing, two-pass strategy, dress rehearsals"
          color={C.gray500}
        />

        <Text style={[T.taglineSub, { marginTop: 12 }]}>
          Time follows where the points actually live — not where the test is weighted.
        </Text>
      </Content>
      <SlideFooter n={n} total={d.totalSlides} />
    </Page>
  );
}

// ── SLIDE 7: Phases ───────────────────────────────────────────────────────
function Slide7Phases({ d, n, phases, part }) {
  const isExpanded = d.expandPhases;
  const subtitle = isExpanded
    ? `${d.phaseCount} phases. Part ${part} of 2.`
    : `${d.phaseCount} phases. One mission per phase.`;

  // Grid: 2×2 for ≤4 phases, or 1×N for 5+
  const use2Col = phases.length <= 4;

  return (
    <Page size={[PW, PH]}>
      <BrandHeader firstName={d.firstName} cat="THE ROADMAP" />
      <Content justify="flex-start" pt={8}>
        <Text style={T.header}>EACH PHASE HAS ONE JOB</Text>
        <Text style={T.subtitle}>{subtitle}</Text>

        <View style={{
          flexDirection: use2Col ? 'row' : 'column',
          flexWrap: use2Col ? 'wrap' : 'nowrap',
          gap: 12,
        }}>
          {phases.map((ph, i) => (
            <PhaseCard
              key={i}
              phase={ph}
              style={{
                flex: use2Col ? undefined : 1,
                width: use2Col ? '48.5%' : undefined,
              }}
            />
          ))}
        </View>

        <Text style={[T.taglineSub, { marginTop: 10 }]}>
          {d.showTwoGears
            ? 'Narrow &amp; consistent during school year. Acceleration when summer hits.'
            : `One domain per session. Each phase builds on the last.`}
        </Text>
      </Content>
      <SlideFooter n={n} total={d.totalSlides} />
    </Page>
  );
}

// ── SLIDE 8: Two Gears (conditional) ─────────────────────────────────────
function Slide8TwoGears({ d, n }) {
  const sySessionsPerWk = 1;
  const sumSessionsPerWk = 2;
  const syPhaseNames = d.syPhases.map(ph => ph.shortName).join(', ');
  const sumPhaseNames = d.sumPhases.map(ph => ph.shortName).join(', ');

  return (
    <Page size={[PW, PH]}>
      <BrandHeader firstName={d.firstName} cat="CADENCE" />
      <Content>
        <Text style={T.header}>TWO GEARS</Text>
        <Text style={T.subtitle}>School Year: focused. Summer: full throttle.</Text>

        <View style={{ flexDirection: 'row', gap: 20 }}>
          {/* School Year column */}
          <View style={{ flex: 1, backgroundColor: C.navy100, borderRadius: 12, padding: 24 }}>
            <Text style={T.cardTitle}>SCHOOL YEAR · WEEKS {d.syWkStart}–{d.syWkEnd}</Text>
            <Text style={{ fontSize: 36, fontFamily: HvB, color: C.navy900, marginBottom: 4, lineHeight: 1 }}>
              {sySessionsPerWk}
            </Text>
            <Text style={{ fontSize: 11, color: C.gray700, marginBottom: 12 }}>session / week</Text>
            <Text style={{ fontSize: 11, fontFamily: HvB, color: C.navy700, marginBottom: 8 }}>
              {d.syHrs} hrs total in-session time
            </Text>
            {[
              `1 hour per week, 1 domain per session`,
              syPhaseNames ? `Phases: ${syPhaseNames}` : 'Foundation phases',
              `Goal: ${d.weakSec} trending toward mid-range by summer`,
            ].map((item, i) => (
              <View key={i} style={{ flexDirection: 'row', marginBottom: 4 }}>
                <Text style={{ fontSize: 10, color: C.coral500, marginRight: 6 }}>•</Text>
                <Text style={{ flex: 1, fontSize: 10, color: C.gray700 }}>{item}</Text>
              </View>
            ))}
          </View>

          {/* Summer column */}
          <View style={{ flex: 1, backgroundColor: C.coral100, borderRadius: 12, padding: 24 }}>
            <Text style={T.cardTitle}>SUMMER · WEEKS {d.sumWkStart}–{d.sumWkEnd}</Text>
            <Text style={{ fontSize: 36, fontFamily: HvB, color: C.coral500, marginBottom: 4, lineHeight: 1 }}>
              {sumSessionsPerWk}
            </Text>
            <Text style={{ fontSize: 11, color: C.gray700, marginBottom: 12 }}>sessions / week</Text>
            <Text style={{ fontSize: 11, fontFamily: HvB, color: C.navy700, marginBottom: 8 }}>
              {d.sumHrs} hrs total in-session time
            </Text>
            {[
              `Cadence doubles. Density doubles.`,
              sumPhaseNames ? `Phases: ${sumPhaseNames}` : 'Acceleration + final sprint',
              `Goal: ${d.target}+ locked in before Test #${d.testCount - 1}`,
            ].map((item, i) => (
              <View key={i} style={{ flexDirection: 'row', marginBottom: 4 }}>
                <Text style={{ fontSize: 10, color: C.coral500, marginRight: 6 }}>•</Text>
                <Text style={{ flex: 1, fontSize: 10, color: C.gray700 }}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={[T.taglineSub, { marginTop: 14 }]}>
          Homework: 1–2 hrs/wk school year  →  3–4 hrs/wk summer  ·  All on StudyCore.
        </Text>
      </Content>
      <SlideFooter n={n} total={d.totalSlides} />
    </Page>
  );
}

// ── SLIDE 9: Checkpoints ──────────────────────────────────────────────────
function Slide9({ d, n }) {
  const cadenceWeeks = d.weeks > 0 && d.testCount > 0
    ? Math.round(d.weeks / d.testCount)
    : 3;

  // Build checkpoint items
  const items = d.testRows.length > 0
    ? d.testRows.map((r, i) => {
        const wkMatch = (r.milestone || '').match(/[Ww]k\.?\s*(\d+)/);
        const wk = wkMatch ? parseInt(wkMatch[1]) : null;
        return {
          num: i + 1,
          wk: wk ? `Wk ${wk}` : `Wk ~${Math.round((i + 1) * (d.weeks / (d.testCount + 1)))}`,
          range: r.total || '—',
          job: d.checkJobs[i] || d.fallbackJobs[i] || 'Progress check',
        };
      })
    : Array.from({ length: d.testCount }, (_, i) => ({
        num: i + 1,
        wk: `Wk ${Math.round((i + 1) * (d.weeks / (d.testCount + 1)))}`,
        range: `${Math.round(d.baseline + (d.totalLift * (i + 1) / (d.testCount + 1)))}`,
        job: d.fallbackJobs[i] || 'Progress check',
      }));

  // Arrange in rows of 3
  const perRow = Math.min(3, Math.ceil(items.length / 2));
  return (
    <Page size={[PW, PH]}>
      <BrandHeader firstName={d.firstName} cat="CHECKPOINTS" />
      <Content justify="flex-start" pt={8}>
        <Text style={T.header}>WE DON'T GUESS. WE MEASURE.</Text>
        <Text style={T.subtitle}>{d.testCount} full practice tests. One every {cadenceWeeks}–{cadenceWeeks + 1} weeks.</Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          {items.map((item, i) => (
            <View key={i} style={{
              width: `${Math.floor(100 / perRow) - 2}%`,
              backgroundColor: C.white,
              borderWidth: 1, borderColor: C.gray200,
              borderRadius: 10, padding: 14,
            }}>
              {/* Badge */}
              <View style={{
                width: 28, height: 28, borderRadius: 14,
                backgroundColor: C.coral500,
                alignItems: 'center', justifyContent: 'center',
                marginBottom: 8,
              }}>
                <Text style={{ fontSize: 12, fontFamily: HvB, color: C.white }}>{item.num}</Text>
              </View>
              <Text style={{ fontSize: 10, fontFamily: HvB, color: C.navy700 }}>Test #{item.num}</Text>
              <Text style={{ fontSize: 10, color: C.gray700 }}>{item.wk}</Text>
              <Text style={{ fontSize: 13, fontFamily: HvB, color: C.coral500, marginTop: 4 }}>{item.range}</Text>
              <Text style={{ fontSize: 9, fontFamily: HvO, color: C.gray700, marginTop: 4 }}>{item.job}</Text>
            </View>
          ))}
        </View>

        <View style={{ backgroundColor: C.navy100, borderRadius: 10, padding: 16 }}>
          <Text style={{ fontSize: 11, fontFamily: HvB, color: C.navy900, marginBottom: 4 }}>
            DIAGNOSTIC TEST DAY
          </Text>
          <Text style={{ fontSize: 10, color: C.gray700 }}>
            Every {cadenceWeeks}–{cadenceWeeks + 1} weeks, we know exactly where {d.firstName} is.
          </Text>
          <Text style={{ fontSize: 10, fontFamily: HvO, color: C.gray500, marginTop: 4 }}>
            If a domain stalls, we adjust the next phase. No surprises on test day.
          </Text>
        </View>
      </Content>
      <SlideFooter n={n} total={d.totalSlides} />
    </Page>
  );
}

// ── SLIDE 10: Progression (line chart) ───────────────────────────────────
function Slide10({ d, n }) {
  const pts = d.chartPoints;

  // Chart layout (in SVG coordinates)
  const cW   = PW - M * 2;         // chart view width
  const cH   = 340;                 // chart view height (SVG)
  const axL  = 80;                  // left axis margin
  const axB  = cH - 40;             // bottom axis y
  const axT  = 24;                  // top padding
  const plotW = cW - axL - 24;
  const plotH = axB - axT;

  // Y range: round down baseline by 100, up target by 100
  const yMin = Math.floor((d.baseline - 80) / 50) * 50;
  const yMax = Math.ceil ((d.target    + 80) / 50) * 50;
  const ySpan = yMax - yMin;

  function yPos(score) {
    return axT + plotH * (1 - (score - yMin) / ySpan);
  }
  function xPos(i) {
    return axL + (plotW / Math.max(pts.length - 1, 1)) * i;
  }

  // Grid lines every 50 points
  const gridLines = [];
  for (let s = yMin; s <= yMax; s += 50) gridLines.push(s);

  // Polyline points string
  const polylinePoints = pts.map((p, i) => `${xPos(i).toFixed(1)},${yPos(p.score).toFixed(1)}`).join(' ');

  // Target horizontal dashed line
  const targetY = yPos(d.target);

  return (
    <Page size={[PW, PH]}>
      <BrandHeader firstName={d.firstName} cat="THE CLIMB" />
      <Content justify="flex-start" pt={8}>
        <Text style={T.header}>THE PROGRESSION</Text>
        <Text style={T.subtitle}>
          Plotted from {d.baselineLabel} baseline to {d.testMonth} target.
        </Text>

        {/* SVG chart */}
        <View style={{ position: 'relative', width: cW, height: cH }}>
          <Svg width={cW} height={cH}>
            {/* Y-axis gridlines */}
            {gridLines.map(s => (
              <Line
                key={s}
                x1={axL} y1={yPos(s)} x2={axL + plotW} y2={yPos(s)}
                stroke={C.gray200} strokeWidth={1}
              />
            ))}
            {/* Target dashed line */}
            <Line
              x1={axL} y1={targetY} x2={axL + plotW} y2={targetY}
              stroke={C.coral500} strokeWidth={1.5} strokeDasharray="8,4"
            />
            {/* Data line */}
            <Polyline
              points={polylinePoints}
              stroke={C.navy700} strokeWidth={2.5} fill="none"
            />
            {/* X-axis line */}
            <Line
              x1={axL} y1={axB} x2={axL + plotW} y2={axB}
              stroke={C.gray200} strokeWidth={1}
            />
            {/* Data point circles */}
            {pts.map((p, i) => (
              <Circle
                key={i}
                cx={xPos(i)} cy={yPos(p.score)} r={p.isTarget ? 8 : 6}
                fill={p.isTarget ? C.green500 : C.navy900}
              />
            ))}
          </Svg>

          {/* Score labels above each point */}
          {pts.map((p, i) => (
            <View key={`sl-${i}`} style={{
              position: 'absolute',
              left: xPos(i) - 28,
              top: yPos(p.score) - 22,
              width: 56,
            }}>
              <Text style={{ fontSize: 10, fontFamily: HvB, color: p.isTarget ? C.green500 : C.navy900, textAlign: 'center' }}>
                {p.score}{p.isTarget ? '+' : ''}
              </Text>
            </View>
          ))}

          {/* X-axis labels */}
          {pts.map((p, i) => (
            <View key={`xl-${i}`} style={{
              position: 'absolute',
              left: xPos(i) - 32,
              top: axB + 6,
              width: 64,
            }}>
              <Text style={{ fontSize: 9, color: C.gray700, textAlign: 'center' }}>{p.label}</Text>
            </View>
          ))}

          {/* Y-axis labels */}
          {gridLines.map(s => (
            <View key={`yl-${s}`} style={{
              position: 'absolute',
              left: 0,
              top: yPos(s) - 7,
              width: axL - 6,
            }}>
              <Text style={{ fontSize: 9, color: C.gray500, textAlign: 'right' }}>{s}</Text>
            </View>
          ))}

          {/* Target label */}
          <View style={{ position: 'absolute', left: axL + plotW + 4, top: targetY - 7, width: 24 }}>
            <Text style={{ fontSize: 8, color: C.coral500 }}>TARGET</Text>
          </View>
        </View>

        <Text style={[T.tagline, { marginTop: 16 }]}>
          +{d.totalLift} points across {d.weeks} weeks.  {d.weakSec} carries +{d.weakLift}.  {d.strongSec} carries +{d.strongLift}.
        </Text>
        <Text style={T.taglineSub}>
          Hit each checkpoint, and {d.testMonth} is locked in before we walk into the test.
        </Text>
      </Content>
      <SlideFooter n={n} total={d.totalSlides} />
    </Page>
  );
}

// ── SLIDE 11: What It Unlocks ─────────────────────────────────────────────
function Slide11({ d, n }) {
  const isSTEM = d.scoreBand === 'STEM-tier';
  const isIvy  = d.scoreBand === 'Ivy-tier';

  const card01Body = isSTEM
    ? `${d.target}+ with ${d.mathTargetStr} Math signals analytical range — Math elite, R/W proven.`
    : isIvy
    ? `${d.target}+ with ${d.strongScore}+ ${d.strongSec} signals the academic breadth ${d.scoreBand} programs look for.`
    : `${d.target}+ with ${d.strongScore}+ ${d.strongSec} puts ${d.firstName} in the competitive range for selective universities.`;

  const card02Body = `Lifts the one ${d.weakSec} flag on an otherwise ${d.strongSec}-strong application profile.`;

  const collegeMention = d.cols ? d.cols.split(',').slice(0, 2).map(c => c.trim()).join(' and ') : null;
  const card03Body = collegeMention
    ? `Competitive at ${collegeMention}${d.cols.split(',').length > 2 ? ' and more' : ''} — ${d.scoreBand} target within reach.`
    : `Strong university applications where ${d.target}+ puts ${d.firstName} in the upper range of admitted students.`;

  const taglineSub = `It's about removing the ${d.weakSec} flag on an otherwise ${d.strongSec}-strong application.`;

  return (
    <Page size={[PW, PH]}>
      <BrandHeader firstName={d.firstName} cat="THE OUTCOME" />
      <Content>
        <Text style={T.header}>WHAT {d.target}+ UNLOCKS</Text>
        <Text style={T.subtitle}>The score that opens {d.scoreBand} doors.</Text>

        <View style={{ gap: 14, marginBottom: 20 }}>
          {[
            { num: '01', title: `${d.scoreBand} composite`, body: card01Body },
            { num: '02', title: 'Removes the only flag', body: card02Body },
            { num: '03', title: 'Top programs in range', body: card03Body },
          ].map(card => (
            <View key={card.num} style={{
              backgroundColor: C.white,
              borderWidth: 1.5, borderColor: C.coral100,
              borderLeftWidth: 5, borderLeftColor: C.coral500,
              borderRadius: 10, padding: 20,
              flexDirection: 'row', alignItems: 'flex-start', gap: 16,
            }}>
              <Text style={{ fontSize: 28, fontFamily: HvB, color: C.gray200 }}>{card.num}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontFamily: HvB, color: C.navy700, marginBottom: 4 }}>{card.title}</Text>
                <Text style={T.cardBody}>{card.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={T.tagline}>It's not about the composite number.</Text>
        <Text style={T.taglineSub}>{taglineSub}</Text>
      </Content>
      <SlideFooter n={n} total={d.totalSlides} />
    </Page>
  );
}

// ── SLIDE 12: Lock It In ──────────────────────────────────────────────────
function Slide12({ d, n }) {
  const phase1Name = d.parsedPhases[0]?.shortName || 'Foundation';
  const recapParts = [
    `${d.weeks} weeks`, `${d.totalHours} hrs`,
    `${d.phaseCount} phases`, `${d.testCount} practice tests`,
    `Target: ${d.testMonthYear} SAT ${d.target}+`,
  ].join('  ·  ');

  return (
    <Page size={[PW, PH]}>
      <BrandHeader firstName={d.firstName} cat="NEXT STEPS" />
      <Content>
        <Text style={T.header}>LET'S LOCK IT IN</Text>
        <Text style={T.subtitle}>Three steps to start the climb.</Text>

        <View style={{ gap: 12, marginBottom: 20 }}>
          {[
            {
              n: '1',
              title: 'ENROLL TODAY',
              body: `Lock in your start date and pricing. We hold the ${d.testMonth} SAT seat.`,
            },
            {
              n: '2',
              title: 'DIAGNOSTIC TEST',
              body: `Full StudyCore SAT diagnostic before Week 1. True SAT baseline confirmed.`,
            },
            {
              n: '3',
              title: 'FIRST SESSION',
              body: `Meet your coach. Walk through results. Begin Phase 1: ${phase1Name}.`,
            },
          ].map(step => (
            <View key={step.n} style={{
              flexDirection: 'row', gap: 16,
              backgroundColor: C.navy100, borderRadius: 12, padding: 20,
              alignItems: 'center',
            }}>
              <View style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: C.coral500,
                alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Text style={{ fontSize: 18, fontFamily: HvB, color: C.white }}>{step.n}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontFamily: HvB, color: C.coral500, marginBottom: 3 }}>
                  {step.title}
                </Text>
                <Text style={T.cardBody}>{step.body}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Recap bar */}
        <View style={{ backgroundColor: C.navy900, borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <Text style={{ fontSize: 9, color: C.gray500, marginBottom: 4 }}>RECAP</Text>
          <Text style={{ fontSize: 11, color: C.white, fontFamily: HvB }}>{recapParts}</Text>
        </View>

        <Text style={T.tagline}>{d.thesis}</Text>
        <Text style={T.taglineSub}>The plan is built around where the points actually live.</Text>
      </Content>
      <SlideFooter n={n} total={d.totalSlides} />
    </Page>
  );
}

// ── Main document builder ─────────────────────────────────────────────────────
function PresentationDocument({ gamePlan, studentData, studentName }) {
  const d = derive(gamePlan, studentData, studentName);
  const slides = [];
  let sn = 1; // slide number counter

  slides.push(<Slide1  key="s1"  d={d} n={sn++} />);
  slides.push(<Slide2  key="s2"  d={d} n={sn++} />);
  slides.push(<Slide3  key="s3"  d={d} n={sn++} />);
  slides.push(<Slide4  key="s4"  d={d} n={sn++} />);
  slides.push(<Slide5  key="s5"  d={d} n={sn++} />);

  if (d.showTimeAlloc) {
    slides.push(<Slide6TimeAlloc key="s6t" d={d} n={sn++} />);
  }

  if (d.expandPhases) {
    const half = Math.ceil(d.phaseCount / 2);
    slides.push(<Slide7Phases key="s7a" d={d} n={sn++} phases={d.parsedPhases.slice(0, half)} part={1} />);
    slides.push(<Slide7Phases key="s7b" d={d} n={sn++} phases={d.parsedPhases.slice(half)} part={2} />);
  } else {
    slides.push(<Slide7Phases key="s7"  d={d} n={sn++} phases={d.parsedPhases} part={null} />);
  }

  if (d.showTwoGears) {
    slides.push(<Slide8TwoGears key="s8" d={d} n={sn++} />);
  }

  slides.push(<Slide9  key="s9"  d={d} n={sn++} />);
  slides.push(<Slide10 key="s10" d={d} n={sn++} />);
  slides.push(<Slide11 key="s11" d={d} n={sn++} />);
  slides.push(<Slide12 key="s12" d={d} n={sn++} />);

  return <Document>{slides}</Document>;
}

// ── Public export ─────────────────────────────────────────────────────────────
export async function buildPresentationPdf(gamePlan, studentData, studentName) {
  const element = React.createElement(PresentationDocument, { gamePlan, studentData, studentName });
  return renderToBuffer(element);
}
