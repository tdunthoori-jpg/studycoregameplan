import { buildPresentationPdf } from '../../../lib/pdf-presentation';
import { buildGamePlanPdf } from '../../../lib/pdf-game-plan';
import { buildMeetingScriptPdf } from '../../../lib/pdf-script';

// Mock data mirroring the Jaisel example from the spec
const MOCK_GAME_PLAN = {
  tagline: 'Math is elite. R/W is the climb.',
  scoreBoxes: {
    box1: { label: 'Current R/W', value: '590', subtitle: 'PSAT Oct 2025' },
    box2: { label: 'Current Math', value: '760', subtitle: 'PSAT Oct 2025' },
    box3: { label: 'Score Gap', value: '+150', subtitle: 'To Target' },
    box4: { label: 'Target', value: '1500+', subtitle: 'August 2026' },
  },
  mainCallout: {
    title: 'The Opportunity',
    body: 'Jaisel has a 1350 with zero prep. Math is already elite (99th percentile). R/W is the entire gap.',
  },
  bottleneckCallout: {
    title: 'The Bottleneck',
    body: 'SEC at 490–540 and C&S at 550–600 are the two domains dragging R/W down 170 points below Math.',
  },
  scoreAnalysis: 'Jaisel scored 590 R/W and 760 Math for a 1350 PSAT total. Math at 99th percentile is already elite. R/W at 76th percentile is the sole bottleneck. SEC (490–540) is the fastest fix; C&S and I&I follow.',
  domainPriority: [
    { domain: 'Standard English Conventions', performance: '490–540', target: '610–670', priority: 'High' },
    { domain: 'Information & Ideas', performance: '550–600', target: '680–760', priority: 'High' },
    { domain: 'Craft & Structure', performance: '550–600', target: '680–760', priority: 'High' },
    { domain: 'Expression of Ideas', performance: '610–670', target: '680–760', priority: 'Medium' },
    { domain: 'Algebra', performance: '680–760', target: '680–800', priority: 'Protect' },
    { domain: 'Advanced Math', performance: '680–760', target: '680–800', priority: 'Protect' },
    { domain: 'Problem-Solving & Data Analysis', performance: '680–760', target: '680–800', priority: 'Low' },
    { domain: 'Geometry & Trigonometry', performance: '680–760', target: '680–800', priority: 'Protect' },
  ],
  programOverview: {
    duration: '18 weeks (Apr 20 – Aug 22, 2026)',
    sessions: '28 sessions × 1 hr = 28 hours',
    structure: '1 session/week school year, 2 sessions/week summer',
    homework: '1–2 hrs/week school year, 3–4 hrs/week summer',
    practiceTests: '6 full practice tests (one every 2–3 weeks)',
    target: '1500+ by August 2026 SAT',
  },
  focusAreas: [
    { number: 1, title: 'SEC Rebuild (Weeks 1–4)', body: 'Sentence boundaries, subject-verb agreement, modifier placement — finite rule set, fastest returns.' },
    { number: 2, title: 'R/W Foundation (Weeks 5–8)', body: 'Information & Ideas evidence questions + Craft & Structure decision tree (WiC, Text Structure, Cross-Text).' },
    { number: 3, title: 'Summer Acceleration (Weeks 9–14)', body: 'Hardest-difficulty R/W items. Math PSDA rebuild and Advanced Math ceiling work. Two sessions/week.' },
    { number: 4, title: 'Peak Performance (Weeks 15–18)', body: 'Pressure training under timed conditions. Two full dress rehearsals. Final gap close.' },
  ],
  weekByWeekIntro: 'School year sessions run 1/week at 1 hour. Summer doubles to 2/week. Each session targets one domain.',
  phases: [
    {
      title: 'PHASE 1 — SEC Rebuild | Weeks 1–4 | 4 hrs',
      description: 'Attack the lowest R/W domain (SEC 490–540). Most mechanical gains. Sentence boundaries, subject-verb agreement, modifier placement. Fastest points in the program.',
      weeks: [
        { weekNum: '1', dateRange: 'Apr 20', title: 'SEC Decision Tree + Practice Test #1', sessionContent: '60 min: Full SEC rules intro. Decision tree walkthrough. Practice Test #1 administered (Wk 1).', testTarget: 'Practice Test #1 baseline: 1350–1390', homework: ['20 SEC questions on StudyCore (45 min)', 'Review Practice Test #1 errors (30 min)', 'Total: ~1.25 hrs'] },
        { weekNum: '2–4', dateRange: 'Apr 27', title: 'SEC Mastery Blocks', sessionContent: '3 sessions × 60 min: Full SEC mastery — punctuation, agreement, fragments, run-ons. Model decision tree on every question type.', testTarget: null, homework: ['25 SEC drills/week on StudyCore (50 min)', 'Total: ~50 min/wk'] },
      ],
      phaseComplete: 'SEC lifted from 490–540 to 550–600 range. R/W trending toward 620+.',
    },
    {
      title: 'PHASE 2 — R/W Foundation | Weeks 5–8 | 4 hrs',
      description: 'Information & Ideas and Craft & Structure. Lift both from 550–600 to 610–670 range via decision frameworks for each question type.',
      weeks: [
        { weekNum: '5–6', dateRange: 'May 18', title: 'I&I Framework + Practice Test #2', sessionContent: '2 sessions × 60 min: Main idea, inference, evidence-based questions. Predict-then-match strategy. Practice Test #2 (Wk 6).', testTarget: 'Practice Test #2 target: 1380–1420', homework: ['I&I drills (40 min/wk)', 'Practice Test #2 review (45 min)'] },
        { weekNum: '7–8', dateRange: 'Jun 1', title: 'C&S Decision Tree', sessionContent: '2 sessions × 60 min: Words in Context predict-then-match. Text Structure & Purpose. Cross-Text Connections pairing framework.', testTarget: null, homework: ['C&S practice set (40 min/wk) on StudyCore'] },
      ],
      phaseComplete: 'R/W trending 640+. Foundation established for summer acceleration.',
    },
    {
      title: 'PHASE 3 — Summer Acceleration | Weeks 9–14 | 12 hrs',
      description: 'Two sessions per week. Hardest-difficulty R/W items. Math PSDA rebuild and Advanced Math ceiling drilling. Densest block of the program.',
      weeks: [
        { weekNum: '9–10', dateRange: 'Jun 22', title: 'Hard R/W + Practice Test #3', sessionContent: '4 sessions × 60 min: Level 3-4 R/W items. I&I Evidence-based deep read. Timed section simulation. Practice Test #3 (Wk 10).', testTarget: 'Practice Test #3 target: 1420–1460', homework: ['3–4 hrs/week on StudyCore across all R/W domains'] },
        { weekNum: '11–12', dateRange: 'Jul 6', title: 'PSDA + Advanced Math Ceiling', sessionContent: '4 sessions × 60 min: Math PSDA data interpretation. Advanced Math hardest items. Dual-domain integration sessions.', testTarget: null, homework: ['Math + R/W drills 3–4 hrs/wk'] },
        { weekNum: '13–14', dateRange: 'Jul 20', title: 'Full Integration + Practice Test #4', sessionContent: '4 sessions × 60 min: Full R/W + Math integration. Timed modules. Practice Test #4 (Wk 13).', testTarget: 'Practice Test #4 target: 1450–1490', homework: ['Practice Test #4 full review (1 hr)', 'Domain-targeted drills (2 hrs/wk)'] },
      ],
      phaseComplete: '1470+ on Practice Test #4. R/W at 680+. Math holding 780+.',
    },
    {
      title: 'PHASE 4 — Peak Performance | Weeks 15–18 | 8 hrs',
      description: 'Pressure training under real test conditions. Two full dress rehearsals. Final gap close. Walk into August 10 knowing the score.',
      weeks: [
        { weekNum: '15–16', dateRange: 'Aug 3', title: 'Pressure Training + Practice Test #5', sessionContent: '4 sessions × 60 min: Full timed modules. Error analysis under pressure. Practice Test #5 (Wk 16).', testTarget: 'Practice Test #5 target: 1480–1520', homework: ['Practice Test #5 review (1 hr)', 'Final domain clean-up drills (1.5 hrs/wk)'] },
        { weekNum: '17–18', dateRange: 'Aug 10', title: 'Dress Rehearsals + Practice Test #6', sessionContent: '4 sessions × 60 min: Two full dress rehearsals (Practice Test #6 Wk 17). Test-day logistics, pacing locked in. Final session Aug 21.', testTarget: 'Practice Test #6 target: 1490–1530', homework: ['Light review only — no new material last week'] },
      ],
      phaseComplete: '1500+ locked in. Test day August 22, 2026.',
    },
  ],
  scoreProgression: {
    intro: 'Projected milestones assuming 90%+ homework completion:',
    rows: [
      { milestone: 'Baseline (PSAT Oct 2025)', total: '1350', rw: '590', math: '760', indicator: 'Starting point' },
      { milestone: 'Practice Test #1 (Wk 1)', total: '1350–1390', rw: '595–615', math: '755–775', indicator: '↑ 0–40 pts' },
      { milestone: 'Practice Test #2 (Wk 6)', total: '1380–1420', rw: '620–645', math: '760–775', indicator: '↑ 30–70 pts' },
      { milestone: 'Practice Test #3 (Wk 10)', total: '1420–1460', rw: '655–680', math: '765–780', indicator: '↑ 70–110 pts' },
      { milestone: 'Practice Test #4 (Wk 13)', total: '1450–1490', rw: '675–710', math: '775–780', indicator: '↑ 100–140 pts' },
      { milestone: 'Practice Test #5 (Wk 16)', total: '1480–1520', rw: '700–740', math: '780+', indicator: '↑ 130–170 pts' },
      { milestone: 'Practice Test #6 (Wk 17)', total: '1490–1530', rw: '710–750', math: '780+', indicator: 'Dress rehearsal' },
      { milestone: 'Target (Aug 2026)', total: '1500+', rw: '720+', math: '780+', indicator: '🎯 Goal' },
    ],
    note: 'Projections assume consistent homework. Math held at 780+ throughout.',
  },
  bottomLine: 'Math is elite. R/W is the entire gap. 18 weeks of targeted R/W instruction — built around SEC, I&I, and C&S — closes the gap. The plan is engineered around the August SAT.',
};

const MOCK_STUDENT_DATA = {
  studentName: 'Jaisel Shah',
  grade: '10th',
  testType: 'PSAT',
  rwScore: 590,
  mathScore: 760,
  totalScore: 1350,
  targetScore: 1500,
  targetTestDate: '2026-08-22',
  targetColleges: 'MIT, Georgia Tech, Carnegie Mellon',
  studentLocation: 'Atlanta, GA',
  weeks: 18,
  totalHours: 28,
  sessionsPerWeek: 2,
  sessionLength: '1 hr',
  homeworkHrs: '3-4',
  domains: { ii: '550–600', cs: '550–600', eoi: '610–670', sec: '490–540', alg: '680–760', am: '680–760', psda: '680–760', gt: '680–760' },
};

const MOCK_SCRIPT_MD = `## SECTION 1: INTRO & RAPPORT BUILDING (3–5 minutes)

**"Hey! Can you hear me okay? Great — so nice to meet you. Jaisel, how are you doing?"**

[Light conversation. Note interests, activities.]

**"So Jaisel took the PSAT in October and scored 1350. Before I show you the breakdown — how did that feel when the score came back?"**

[Listen.]

**"Here's what I want to say right upfront — Math at 760 on a 1350 test. That number does not belong."**

---

## SECTION 7: PRICING & CLOSE (6–8 minutes)

**"The full 18-week program is $3,200. That's 28 hours at $114/hr."**

**"Sound good?"** [Wait for yes.]`;

export async function GET() {
  const results = [];
  const t0 = Date.now();

  function record(label, ok, detail = '') {
    results.push({ label, ok, detail });
  }

  // ── Test 1: buildPresentationPdf ──────────────────────────────────────────
  try {
    const buf = await buildPresentationPdf(MOCK_GAME_PLAN, MOCK_STUDENT_DATA, 'Jaisel Shah');
    record('buildPresentationPdf returns a Buffer', Buffer.isBuffer(buf));
    record('Presentation PDF >= 20 KB', buf.length >= 20000, `${(buf.length / 1024).toFixed(1)} KB`);
    // PDF magic bytes: %PDF
    const isPDF = buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46;
    record('Presentation PDF has valid PDF header (%PDF)', isPDF);
  } catch (err) {
    record('buildPresentationPdf', false, err.message);
  }

  // ── Test 2: buildGamePlanPdf ──────────────────────────────────────────────
  try {
    const buf = await buildGamePlanPdf(MOCK_GAME_PLAN, 'Jaisel Shah');
    record('buildGamePlanPdf returns a Buffer', Buffer.isBuffer(buf));
    record('Game plan PDF >= 20 KB', buf.length >= 20000, `${(buf.length / 1024).toFixed(1)} KB`);
  } catch (err) {
    record('buildGamePlanPdf', false, err.message);
  }

  // ── Test 3: buildMeetingScriptPdf ─────────────────────────────────────────
  try {
    const buf = await buildMeetingScriptPdf(MOCK_SCRIPT_MD, 'Jaisel Shah');
    record('buildMeetingScriptPdf returns a Buffer', Buffer.isBuffer(buf));
    record('Meeting script PDF >= 1 KB', buf.length >= 1000, `${(buf.length / 1024).toFixed(1)} KB`);
  } catch (err) {
    record('buildMeetingScriptPdf', false, err.message);
  }

  // ── Test 4: All three in parallel (mirrors the real API route) ────────────
  try {
    const [gp, sc, pr] = await Promise.all([
      buildGamePlanPdf(MOCK_GAME_PLAN, 'Jaisel Shah'),
      buildMeetingScriptPdf(MOCK_SCRIPT_MD, 'Jaisel Shah'),
      buildPresentationPdf(MOCK_GAME_PLAN, MOCK_STUDENT_DATA, 'Jaisel Shah'),
    ]);
    record('Parallel build: all three succeed', Buffer.isBuffer(gp) && Buffer.isBuffer(sc) && Buffer.isBuffer(pr));
    record('Parallel build: no buffer is empty', gp.length > 0 && sc.length > 0 && pr.length > 0);
  } catch (err) {
    record('Parallel build (3 PDFs)', false, err.message);
  }

  // ── Test 5: Inverted profile (Math is weak, R/W is strong) ────────────────
  try {
    const invertedData = { ...MOCK_STUDENT_DATA, rwScore: 720, mathScore: 580, totalScore: 1300, targetScore: 1450 };
    const buf = await buildPresentationPdf(MOCK_GAME_PLAN, invertedData, 'Alex Kim');
    record('Inverted profile (R/W strong, Math weak) renders', Buffer.isBuffer(buf) && buf.length > 20000);
  } catch (err) {
    record('Inverted profile', false, err.message);
  }

  // ── Test 6: Balanced profile ──────────────────────────────────────────────
  try {
    const balancedData = { ...MOCK_STUDENT_DATA, rwScore: 640, mathScore: 650, totalScore: 1290, targetScore: 1400 };
    const buf = await buildPresentationPdf(MOCK_GAME_PLAN, balancedData, 'Sam Lee');
    record('Balanced profile renders without error', Buffer.isBuffer(buf) && buf.length > 20000);
  } catch (err) {
    record('Balanced profile', false, err.message);
  }

  // ── Test 7: Missing optional fields ──────────────────────────────────────
  try {
    const minimalPlan = {
      ...MOCK_GAME_PLAN,
      phases: MOCK_GAME_PLAN.phases.slice(0, 2),
      scoreProgression: { rows: [] },
    };
    const minimalData = { ...MOCK_STUDENT_DATA, targetColleges: '', targetTestDate: '' };
    const buf = await buildPresentationPdf(minimalPlan, minimalData, 'Test Student');
    record('Minimal data (no colleges, no test date) renders', Buffer.isBuffer(buf) && buf.length > 10000);
  } catch (err) {
    record('Minimal data', false, err.message);
  }

  const elapsed = Date.now() - t0;
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;

  return Response.json({
    summary: { passed, failed, total: results.length, elapsed_ms: elapsed },
    note: 'Presentation PDF adds zero Claude API calls — built from existing gamePlan JSON. Credit usage unchanged.',
    results,
  });
}
