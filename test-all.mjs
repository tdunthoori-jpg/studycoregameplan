/**
 * Comprehensive test suite for studycore-gameplan
 * Tests: JSON parsing, code-fence stripping, docx-builder, script-builder, recommend logic
 */

import { buildGamePlanDocx } from './lib/docx-builder.js';
import { buildMeetingScriptDocx } from './lib/script-builder.js';
import {
  getRecommendation,
  weeksUntilDate,
  parseStateFromLocation,
  SAT_TEST_DATES,
  PERFORMANCE_BANDS,
} from './lib/recommend.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅  ${label}`);
    passed++;
  } else {
    console.error(`  ❌  ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(60));
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_GAME_PLAN = {
  tagline: "Same Score Twice. Different Score in June.",
  scoreBoxes: {
    box1: { label: "Current R/W", value: "540",  subtitle: "Mar 2025 SAT" },
    box2: { label: "Current Math", value: "510", subtitle: "Mar 2025 SAT" },
    box3: { label: "Score Gap",   value: "+350", subtitle: "To Target" },
    box4: { label: "Target",      value: "1400", subtitle: "June 2026" },
  },
  mainCallout: {
    title: "The Opportunity",
    body: "Alex has a 1050 today. With focused work on C&S and Advanced Math, 1400 is realistic within 10 weeks."
  },
  bottleneckCallout: {
    title: "The Bottleneck",
    body: "Craft & Structure and Advanced Math are the two domains dragging both section scores down."
  },
  scoreAnalysis: "Alex scored 540 R/W and 510 Math for a 1050 total on the March 2025 SAT. The R/W section is held back primarily by Craft & Structure, while Math struggles most in Advanced Math and Geometry.",
  domainPriority: [
    { domain: "Craft & Structure", performance: "450–500", target: "550–600", priority: "High" },
    { domain: "Information & Ideas", performance: "500–550", target: "550–600", priority: "Medium" },
    { domain: "Expression of Ideas", performance: "550–600", target: "610–670", priority: "Low" },
    { domain: "Standard English Conventions", performance: "500–550", target: "610–670", priority: "High" },
    { domain: "Algebra", performance: "550–600", target: "610–670", priority: "Medium" },
    { domain: "Advanced Math", performance: "450–500", target: "550–600", priority: "High" },
    { domain: "Problem-Solving & Data Analysis", performance: "500–550", target: "550–600", priority: "Medium" },
    { domain: "Geometry & Trigonometry", performance: "400–450", target: "500–550", priority: "High" },
  ],
  programOverview: {
    duration: "10 weeks",
    sessions: "20 sessions × 1 hr = 20 hours",
    structure: "2 sessions/week, alternating R/W and Math focus",
    homework: "3–4 hrs/week of targeted drills",
    practiceTests: "Full practice test every 3 weeks",
    target: "1400 by June 2026 SAT",
  },
  focusAreas: [
    { number: 1, title: "Craft & Structure Mastery", body: "Words in Context decision tree + Text Structure patterns" },
    { number: 2, title: "SEC Quick Wins", body: "Sentence boundaries, subject-verb agreement, pronoun-antecedent" },
    { number: 3, title: "Advanced Math Foundations", body: "Function notation, quadratics, systems of equations" },
    { number: 4, title: "Geometry & Trig", body: "Circle theorems, right triangle trig, area/volume formulas" },
  ],
  weekByWeekIntro: "Each week builds on the last. Weeks with practice tests include lighter homework.",
  phases: [
    {
      title: "PHASE 1 — Diagnostic + R/W Foundation | Weeks 1–3 | 6 hours",
      description: "Establish baseline and attack the highest-priority R/W domains.",
      weeks: [
        {
          weekNum: "1",
          dateRange: "Apr 7",
          title: "Diagnostic + C&S Introduction",
          sessionContent: "Session 1 (60 min): Full diagnostic R/W module. Identify error patterns. Introduce predict-then-match strategy for Words in Context.\nSession 2 (60 min): C&S deep dive — Text Structure & Purpose. Model 5 examples. Decision framework: 'What is this paragraph doing?'",
          testTarget: null,
          homework: ["Complete 20 WiC questions using predict-then-match (45 min)", "Review diagnostic errors — categorize each miss (20 min)", "Total: ~1.5 hrs"],
        },
        {
          weekNum: "2",
          dateRange: "Apr 14",
          title: "C&S Continued + SEC Intro",
          sessionContent: "Session 3 (60 min): C&S Cross-text Connections. Pair passages with relationship mapping.\nSession 4 (60 min): SEC intro — sentence boundaries (run-ons, fragments, semicolons). SEC decision tree walkthrough.",
          testTarget: "Mini-test target: 80%+ on C&S WiC questions",
          homework: ["15 C&S questions mixed (30 min)", "20 SEC punctuation questions (40 min)", "Total: ~1.5 hrs"],
        },
        {
          weekNum: "3",
          dateRange: "Apr 21",
          title: "Practice Test #1",
          sessionContent: "Session 5 (60 min): Full practice test R/W review. Score breakdown, error categorization.\nSession 6 (60 min): R/W pacing strategy. Two-pass method. Module 1 vs Module 2 approach.",
          testTarget: "Practice Test #1 — target 570+ R/W",
          homework: ["Full practice test (3 hrs)", "Error log — 1 sentence per miss (30 min)", "Total: ~3.5 hrs"],
        },
      ],
      phaseComplete: "Phase 1 complete — R/W foundation established. Expect 20–30 point R/W improvement.",
    },
    {
      title: "PHASE 2 — Math Foundation | Weeks 4–6 | 6 hours",
      description: "Attack the two biggest Math gaps: Advanced Math and Geometry.",
      weeks: [
        {
          weekNum: "4",
          dateRange: "Apr 28",
          title: "Advanced Math — Functions & Quadratics",
          sessionContent: "Session 7 (60 min): Function notation, domain/range, function composition. 'Input-output machine' mental model.\nSession 8 (60 min): Quadratics — standard vs vertex form. Completing the square. Zero-product property.",
          testTarget: null,
          homework: ["20 Advanced Math questions (40 min)", "Khan Academy: Quadratics unit (30 min)", "Total: ~1.5 hrs"],
        },
        {
          weekNum: "5",
          dateRange: "May 5",
          title: "Geometry & Trigonometry",
          sessionContent: "Session 9 (60 min): Circle theorems, arc length, sector area. Formula sheet strategy.\nSession 10 (60 min): Right triangle trig (SOH-CAH-TOA), special triangles (30-60-90, 45-45-90).",
          testTarget: null,
          homework: ["15 Geometry questions (30 min)", "10 Trig questions (25 min)", "Total: ~1 hr"],
        },
        {
          weekNum: "6",
          dateRange: "May 12",
          title: "Practice Test #2",
          sessionContent: "Session 11 (60 min): Full practice test Math review.\nSession 12 (60 min): Math pacing — calculator vs no-calculator strategy. Guessing protocol.",
          testTarget: "Practice Test #2 — target 550+ Math",
          homework: ["Full practice test (3 hrs)", "Review all Math errors (45 min)", "Total: ~3.75 hrs"],
        },
      ],
      phaseComplete: "Phase 2 complete — Math foundation solid. Expect 30–40 point Math improvement.",
    },
  ],
  scoreProgression: {
    intro: "Projected score milestones assuming consistent homework completion:",
    rows: [
      { milestone: "Baseline (Mar 2025)", total: "1050", rw: "540", math: "510", indicator: "Starting point" },
      { milestone: "After Phase 1 (Wk 3)", total: "1090–1110", rw: "570", math: "520–540", indicator: "↑ 40–60 pts" },
      { milestone: "After Phase 2 (Wk 6)", total: "1140–1170", rw: "580", math: "560–590", indicator: "↑ 90–120 pts" },
      { milestone: "Target (June 2026)", total: "1400", rw: "700", math: "700", indicator: "🎯 Goal" },
    ],
    note: "Projections assume 90%+ homework completion rate. Actual results vary.",
  },
  bottomLine: "Alex has the foundation to reach 1400. The gap is strategy and targeted practice — not raw intelligence. With 20 hours of focused instruction and consistent homework, this is achievable.",
};

const MOCK_MEETING_SCRIPT = {
  opening: {
    duration: "2–3 min",
    content: "Start by acknowledging how they're feeling about the score. 'How did you feel when you saw the 1050?' Then pivot: 'The good news is we've done this before with students starting right where Alex is.'",
  },
  scoreWalkthrough: {
    duration: "5–7 min",
    content: "Walk through the score report section by section. 'Alex scored 540 on R/W — that puts her in the 45th percentile. The two areas dragging the score down are Craft & Structure and Standard English Conventions.' Show the domain breakdown on the report.",
  },
  opportunity: {
    duration: "3–4 min",
    content: "Frame the opportunity clearly: 'The reason I'm excited about Alex's situation is that C&S and SEC are the most teachable domains on the test. These aren't about intelligence — they're about learning patterns, and Alex clearly has the intelligence.'",
  },
  programStructure: {
    duration: "5–7 min",
    content: "Walk through the game plan document. '20 sessions over 10 weeks — 2 per week, 1 hour each. We alternate R/W and Math focus. Homework is 3–4 hours per week of targeted drills using StudyCore materials.'",
  },
  targetTimeline: {
    duration: "3–4 min",
    content: "Point to the score progression table. 'Here's the realistic roadmap. After the first 3 weeks focused on R/W, we expect a 20–30 point jump. By week 6 we add Math and expect another 30–40 point jump. By June we're targeting 1400.'",
  },
  collegeContext: {
    duration: "2–3 min",
    content: "Reference the target schools. 'UNC Chapel Hill's middle 50% is 1310–1490 — Alex is right on the edge right now. A 1400 puts her squarely in range. Wake Forest is 1360–1530 — a 1400 opens the door.'",
  },
  close: {
    duration: "3–4 min",
    content: "Summarize and make the ask. 'Here's what I'd recommend: we start next week, get the diagnostic done in session 1, and build from there. The program is $X total — we can do a payment plan if that's helpful. Does Tuesday or Thursday work better for your schedule?'",
  },
  strategicQuestions: [
    "What are Alex's top 3 target schools right now, and has she visited any of them?",
    "Has Alex worked with a tutor before — and if so, what did and didn't work?",
    "How is Alex feeling about the college application timeline overall?",
    "Is there a minimum score you'd need to see before feeling confident about applying to UNC?",
    "What would it mean for your family if Alex got into her first-choice school?",
  ],
};

// ─── Test 1: JSON Parsing & Code-Fence Stripping ──────────────────────────────
section('TEST 1: JSON Parsing & Code-Fence Stripping');

function parseClaudeResponse(rawText) {
  let cleanText = rawText.trim();
  if (cleanText.startsWith('```')) {
    cleanText = cleanText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  return JSON.parse(jsonMatch[0]);
}

// 1a: Raw JSON (no fences)
const raw1 = JSON.stringify({ gamePlan: { tagline: 'test' }, meetingScript: {} });
assert('Plain JSON parses correctly', parseClaudeResponse(raw1)?.gamePlan?.tagline === 'test');

// 1b: Wrapped in ```json ... ```
const raw2 = '```json\n' + raw1 + '\n```';
assert('```json fenced JSON parses correctly', parseClaudeResponse(raw2)?.gamePlan?.tagline === 'test');

// 1c: Wrapped in ``` ... ``` (no language tag)
const raw3 = '```\n' + raw1 + '\n```';
assert('Plain ``` fenced JSON parses correctly', parseClaudeResponse(raw3)?.gamePlan?.tagline === 'test');

// 1d: JSON with preamble text
const raw4 = 'Here is the game plan:\n\n' + raw1;
assert('JSON with preamble text parses correctly', parseClaudeResponse(raw4)?.gamePlan?.tagline === 'test');

// 1e: Empty/missing gamePlan
const raw5 = JSON.stringify({ something: 'else' });
const parsed5 = parseClaudeResponse(raw5);
assert('Missing gamePlan is detectable', parsed5 !== null && !parsed5.gamePlan);

// 1f: Invalid JSON returns null
let invalidResult = null;
try { invalidResult = parseClaudeResponse('not json at all'); } catch {}
assert('Invalid JSON returns null/throws', invalidResult === null);

// ─── Test 2: recommend.js ─────────────────────────────────────────────────────
section('TEST 2: recommend.js');

// 2a: Gap-based recommendations
const r50  = getRecommendation(50,  10);
const r150 = getRecommendation(150, 10);
const r300 = getRecommendation(300, 10);
assert('Small gap (50 pts) gives low hours', r50.totalHours <= 15);
assert('Medium gap (150 pts) gives moderate hours', r150.totalHours >= 20 && r150.totalHours <= 30);
// 300pt gap is capped at 30 hrs by the 10-week constraint (2 sessions × 1.5 hrs × 10 wks = 30)
assert('Large gap (300 pts) gives >= 25 hours', r300.totalHours >= 25);
assert('getRecommendation returns sessionsPerWeek', typeof r150.sessionsPerWeek === 'number');
assert('getRecommendation returns sessionLength string', typeof r150.sessionLength === 'string');
assert('getRecommendation returns homeworkHrs string', typeof r150.homeworkHrs === 'string');
assert('getRecommendation returns note string', typeof r150.note === 'string');

// 2b: weeksUntilDate
const futureDate = new Date();
futureDate.setDate(futureDate.getDate() + 70); // 10 weeks out
const wks = weeksUntilDate(futureDate.toISOString().slice(0, 10));
assert('weeksUntilDate returns ~10 for 70 days out', wks >= 9 && wks <= 11);
assert('weeksUntilDate returns 0 for past date', weeksUntilDate('2020-01-01') === 0);

// 2c: parseStateFromLocation
assert('parseStateFromLocation detects NC', parseStateFromLocation('Charlotte, NC') === 'NC');
assert('parseStateFromLocation detects TX', parseStateFromLocation('Dallas, Texas') === 'TX');
assert('parseStateFromLocation handles unknown', parseStateFromLocation('Unknown City') === null);

// 2d: Constants
assert('SAT_TEST_DATES is a non-empty array', Array.isArray(SAT_TEST_DATES) && SAT_TEST_DATES.length > 0);
assert('PERFORMANCE_BANDS has 10 entries', Array.isArray(PERFORMANCE_BANDS) && PERFORMANCE_BANDS.length === 10);
assert('PERFORMANCE_BANDS includes "Below 400"', PERFORMANCE_BANDS.includes('Below 400'));
assert('PERFORMANCE_BANDS includes "680–800"', PERFORMANCE_BANDS.includes('680–800'));

// ─── Test 3: buildGamePlanDocx ────────────────────────────────────────────────
section('TEST 3: buildGamePlanDocx — Full Happy Path');

let gamePlanBuffer;
try {
  gamePlanBuffer = await buildGamePlanDocx(MOCK_GAME_PLAN, 'Alex Johnson');
  assert('buildGamePlanDocx returns a Buffer', Buffer.isBuffer(gamePlanBuffer));
  assert('Game plan docx is at least 10KB', gamePlanBuffer.length > 10000);
  // Check for DOCX magic bytes (PK\x03\x04 — ZIP format)
  assert('Game plan docx starts with ZIP/DOCX magic bytes', gamePlanBuffer[0] === 0x50 && gamePlanBuffer[1] === 0x4B);
  console.log(`     Size: ${(gamePlanBuffer.length / 1024).toFixed(1)} KB`);
} catch (err) {
  assert('buildGamePlanDocx completed without error', false, err.message);
}

// ─── Test 4: buildGamePlanDocx — Edge Cases ───────────────────────────────────
section('TEST 4: buildGamePlanDocx — Edge Cases');

// 4a: Missing optional fields
const minimalGamePlan = {
  tagline: "Test Tagline",
  scoreBoxes: {
    box1: { label: "Test", value: "1200", subtitle: "sub" },
    box2: { label: "Test", value: "600",  subtitle: "sub" },
    box3: { label: "Test", value: "+200", subtitle: "sub" },
    box4: { label: "Test", value: "1400", subtitle: "sub" },
  },
  scoreAnalysis: "Test score analysis paragraph.",
  domainPriority: [],
  phases: [],
};
try {
  const buf = await buildGamePlanDocx(minimalGamePlan, 'Test Student');
  assert('buildGamePlanDocx handles missing optional fields', Buffer.isBuffer(buf) && buf.length > 5000);
} catch (err) {
  assert('buildGamePlanDocx handles missing optional fields', false, err.message);
}

// 4b: Null/undefined values in fields
const nullFieldsPlan = {
  ...MOCK_GAME_PLAN,
  mainCallout: null,
  bottleneckCallout: undefined,
  weekByWeekIntro: null,
  bottomLine: null,
  scoreProgression: null,
};
try {
  const buf = await buildGamePlanDocx(nullFieldsPlan, 'Null Test');
  assert('buildGamePlanDocx handles null callouts/optional sections', Buffer.isBuffer(buf) && buf.length > 5000);
} catch (err) {
  assert('buildGamePlanDocx handles null callouts/optional sections', false, err.message);
}

// 4c: Week with null testTarget
const planWithNullTarget = {
  ...MOCK_GAME_PLAN,
  phases: [{
    title: "PHASE 1",
    description: "Test",
    weeks: [{
      weekNum: "1", dateRange: "Apr 7", title: "Test Week",
      sessionContent: "Test content", testTarget: null,
      homework: ["Homework item 1", "Homework item 2"],
    }],
    phaseComplete: "Done",
  }],
};
try {
  const buf = await buildGamePlanDocx(planWithNullTarget, 'Target Test');
  assert('buildGamePlanDocx handles null testTarget in week', Buffer.isBuffer(buf));
} catch (err) {
  assert('buildGamePlanDocx handles null testTarget in week', false, err.message);
}

// 4d: Empty homework array
const planEmptyHw = {
  ...MOCK_GAME_PLAN,
  phases: [{
    title: "PHASE 1", description: "Test", weeks: [{
      weekNum: "1", dateRange: "Apr 7", title: "Test Week",
      sessionContent: "Test content", testTarget: null, homework: [],
    }], phaseComplete: "Done",
  }],
};
try {
  const buf = await buildGamePlanDocx(planEmptyHw, 'Empty HW Test');
  assert('buildGamePlanDocx handles empty homework array', Buffer.isBuffer(buf));
} catch (err) {
  assert('buildGamePlanDocx handles empty homework array', false, err.message);
}

// 4e: Odd number of focus areas (3 instead of 4)
const planOddFocus = {
  ...MOCK_GAME_PLAN,
  focusAreas: [
    { number: 1, title: "Focus 1", body: "Body 1" },
    { number: 2, title: "Focus 2", body: "Body 2" },
    { number: 3, title: "Focus 3", body: "Body 3" },
  ],
};
try {
  const buf = await buildGamePlanDocx(planOddFocus, 'Odd Focus Test');
  assert('buildGamePlanDocx handles odd number of focus areas', Buffer.isBuffer(buf));
} catch (err) {
  assert('buildGamePlanDocx handles odd number of focus areas', false, err.message);
}

// 4f: Score progression with empty rows
const planEmptyProgression = {
  ...MOCK_GAME_PLAN,
  scoreProgression: { intro: "Test", rows: [], note: "Test note" },
};
try {
  const buf = await buildGamePlanDocx(planEmptyProgression, 'Empty Prog Test');
  assert('buildGamePlanDocx handles empty score progression rows', Buffer.isBuffer(buf));
} catch (err) {
  assert('buildGamePlanDocx handles empty score progression rows', false, err.message);
}

// ─── Test 5: buildMeetingScriptDocx ──────────────────────────────────────────
section('TEST 5: buildMeetingScriptDocx — Full Happy Path');

let scriptBuffer;
try {
  scriptBuffer = await buildMeetingScriptDocx(MOCK_MEETING_SCRIPT, 'Alex Johnson');
  assert('buildMeetingScriptDocx returns a Buffer', Buffer.isBuffer(scriptBuffer));
  assert('Meeting script docx is at least 5KB', scriptBuffer.length > 5000);
  assert('Meeting script docx starts with ZIP/DOCX magic bytes', scriptBuffer[0] === 0x50 && scriptBuffer[1] === 0x4B);
  console.log(`     Size: ${(scriptBuffer.length / 1024).toFixed(1)} KB`);
} catch (err) {
  assert('buildMeetingScriptDocx completed without error', false, err.message);
}

// ─── Test 6: buildMeetingScriptDocx — Edge Cases ─────────────────────────────
section('TEST 6: buildMeetingScriptDocx — Edge Cases');

// 6a: Missing sections
const minimalScript = {
  opening: { duration: "2–3 min", content: "Test opening content" },
  strategicQuestions: ["Question 1?", "Question 2?"],
};
try {
  const buf = await buildMeetingScriptDocx(minimalScript, 'Minimal Test');
  assert('buildMeetingScriptDocx handles missing sections', Buffer.isBuffer(buf));
} catch (err) {
  assert('buildMeetingScriptDocx handles missing sections', false, err.message);
}

// 6b: Empty strategic questions
const scriptNoQuestions = { ...MOCK_MEETING_SCRIPT, strategicQuestions: [] };
try {
  const buf = await buildMeetingScriptDocx(scriptNoQuestions, 'No Questions');
  assert('buildMeetingScriptDocx handles empty strategic questions', Buffer.isBuffer(buf));
} catch (err) {
  assert('buildMeetingScriptDocx handles empty strategic questions', false, err.message);
}

// 6c: Missing strategicQuestions key
const scriptMissingQuestions = { ...MOCK_MEETING_SCRIPT };
delete scriptMissingQuestions.strategicQuestions;
try {
  const buf = await buildMeetingScriptDocx(scriptMissingQuestions, 'Missing Questions');
  assert('buildMeetingScriptDocx handles missing strategicQuestions key', Buffer.isBuffer(buf));
} catch (err) {
  assert('buildMeetingScriptDocx handles missing strategicQuestions key', false, err.message);
}

// ─── Test 7: API Route Logic (without real Claude) ───────────────────────────
section('TEST 7: API Route Logic Simulation');

// Simulate the full pipeline: raw Claude text → strip fences → parse JSON → build docs
const simulatedClaudeOutputs = [
  { label: 'Raw JSON', text: JSON.stringify({ gamePlan: MOCK_GAME_PLAN, meetingScript: MOCK_MEETING_SCRIPT }) },
  { label: '```json fenced', text: '```json\n' + JSON.stringify({ gamePlan: MOCK_GAME_PLAN, meetingScript: MOCK_MEETING_SCRIPT }) + '\n```' },
  { label: 'Preamble + JSON', text: 'Here is the complete plan:\n\n' + JSON.stringify({ gamePlan: MOCK_GAME_PLAN, meetingScript: MOCK_MEETING_SCRIPT }) },
];

for (const { label, text } of simulatedClaudeOutputs) {
  try {
    // Replicate route.js parsing logic exactly
    let cleanText = text.trim();
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');
    const parsed = JSON.parse(jsonMatch[0]);
    const { gamePlan, meetingScript } = parsed;
    if (!gamePlan || !meetingScript) throw new Error('Missing gamePlan or meetingScript');

    const [gpBuf, sBuf] = await Promise.all([
      buildGamePlanDocx(gamePlan, 'Alex Johnson'),
      buildMeetingScriptDocx(meetingScript, 'Alex Johnson'),
    ]);
    assert(`Full pipeline: ${label}`, Buffer.isBuffer(gpBuf) && Buffer.isBuffer(sBuf) && gpBuf.length > 10000);
  } catch (err) {
    assert(`Full pipeline: ${label}`, false, err.message);
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────
section('RESULTS');
const total = passed + failed;
console.log(`  Passed: ${passed}/${total}`);
if (failed > 0) {
  console.error(`  Failed: ${failed}/${total}`);
  process.exit(1);
} else {
  console.log('  All tests passed! ✅');
}
