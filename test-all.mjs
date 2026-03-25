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

// Meeting script is now raw markdown text (not a JSON object)
const MOCK_MEETING_SCRIPT_MARKDOWN = `## INTRO & RAPPORT BUILDING (3–5 minutes)

**"Hey! Can you hear me okay? Great — so nice to meet you both. Alex, how are you doing? How's 11th grade going?"**

[Light conversation. Let Alex talk. Note interests and activities for later.]

* "What subjects feel strongest right now?"
* "Have you done any SAT prep before this?"

**"So Alex took the SAT and scored 1050. Before I show you the breakdown — how did that feel when the score came back?"**

[Listen. Let them describe the reaction without interrupting.]

**"When I looked at the domain breakdown, I saw something that most families would completely miss — one number in this report that tells a completely different story than 1050."**

**"Here's what we're covering today:"**
* The score breakdown and what it actually means
* The 10-week plan to get to 1400
* The UNC Chapel Hill and Wake Forest picture
* Pricing and how to get started

This program needs to start this week to complete before the June 2026 SAT — we have exactly 10 weeks. **"Sound good?"** [Wait for yes.]

---

## SCORE ANALYSIS (7–9 minutes)

**"Share screen."** [Share the game plan document.]

**"Okay — this is Alex's SAT Prep Game Plan. 1050 to 1400. Let me show you what I see…"**

**"This number right here — Expression of Ideas at 550–600 — that does not belong on a 1050 test."** A student scoring in the 550–600 range on EoI is performing like a 1250+ student in that domain. The composite score is being dragged down by two fixable areas.

**Reading & Writing domains:**
* **Craft & Structure at 450–500** — this is THE target. The single highest-leverage fix in the plan. Three question types, each with a learnable framework.
* **Information & Ideas at 500–550** — has a foundation. Needs a push.
* **Expression of Ideas at 550–600** — zero instruction needed. Protect this through practice tests.
* **Standard English Conventions at 450–500** — entirely rule-based. Finite, learnable rules. This is a quick win.

**Math domains:**
* **Algebra at 550–600** — solid. Maintain through practice.
* **Advanced Math at 450–500** — the Math floor. Function notation and quadratics — structured approach unlocks this fast.
* **Problem-Solving & Data Analysis at 500–550** — moderate gap. Foundation is there.
* **Geometry & Trigonometry at 400–450** — largely memorizable content. Learn the formula set, apply it.

**"So here's the full picture. 1050 on the surface. But underneath: Expression of Ideas at 550–600 proves the ability is there. Craft & Structure and Advanced Math are where every point is hiding. This is a test-prep problem, not an ability problem."**

[Pause.] **"Does that make sense?"** [Wait for response.]

---

## COLLEGE CONTEXT (2–3 minutes)

**"UNC Chapel Hill's middle 50% SAT range is 1310–1490. At 1050, Alex is below the 25th percentile. At 1400, she lands in the upper half of admitted students."**

**"Wake Forest is 1360–1530 — a 1400 puts her right at the 25th percentile and into genuine consideration."**

**"The SAT stops being a weakness in the application and becomes a strength."**

---

## THE PLAN WALKTHROUGH (7–9 minutes)

**"10 weeks. 20 total hours. 2 sessions per week, 1 hour each. 3 phases."**

**"R/W gets 60% of instruction time because C&S and SEC are the two domains with the highest point return. Math gets 40% — Advanced Math and Geo/Trig are the targets there."**

* **Phase 1 (Weeks 1–3, 6 hrs):** C&S and SEC foundation. Diagnostic in Session 1. Practice Test #1 target: 570+ R/W.
* **Phase 2 (Weeks 4–6, 6 hrs):** Advanced Math and Geometry. Practice Test #2 target: 550+ Math.
* **Phase 3 (Weeks 7–10, 8 hrs):** Full integration, timed sections, test-day simulation. Final practice test target: 1370+.

**"The homework isn't busywork. Every assignment is calibrated to whatever gaps showed up in the prior session. Always personalized."**

**"Can you see how the phases sequence — R/W foundation first to stop the bleeding, then Math, then full integration?"** [Wait for yes.]

---

## BUILD CONFIDENCE (4–5 minutes)

**"On a scale of 1 to 10 — if Alex goes through all 20 hours, shows up to every session, and does the homework — how confident are you she hits 1400 by June 2026?"**

[Wait for response.]

If 8–10: **"What makes you confident?"** [Let them articulate. Then: "Exactly — Expression of Ideas at 550–600 is the proof. The ability is already there."]

If 6–7: **"What's making you hesitate — what would get you to a 9?"** [Listen, then address:]

* **"350 points is a big jump"** → "Let me break it down: C&S fix = ~80 points. SEC fix = ~60 points. Advanced Math fix = ~80 points. Geo/Trig fix = ~60 points. We're not asking for one giant leap — we're asking for four targeted fixes. EoI at 550–600 already proves the ability."
* **"The timeline is tight"** → "10 weeks works for Alex specifically because her Algebra and EoI are already strong — Phase 1 moves faster when you're not starting from zero. The practice test checkpoints keep us honest."

**"So where are you now — 1 to 10?"** [Should land at 8–9.]

---

## HOW SESSIONS WORK (2–3 minutes)

**"Here's exactly what a session looks like:"**

* **First 10 minutes:** homework review — go through every error, categorize the pattern
* **Next 40–50 minutes:** deep instruction on one specific skill or decision framework — not just practice
* **Last 10 minutes:** homework preview — Alex knows exactly what to do and why before she leaves

**"Early sessions are instruction-heavy. Later sessions are integration and simulation — full timed sections under test conditions."**

**"Alex has the same tutor all 10 weeks. We don't rotate tutors mid-program."**

**"All our tutors scored 1550+ with specific experience in C&S, SEC, and Advanced Math instruction."**

---

## HANDLE OBJECTIONS & CLOSE

**"I need to think about it"**
**"Of course — what specifically are you thinking through? Is it the timing, the investment, or something about the approach?"** [Listen.] **"I can send the full game plan document tonight — but I want to be honest: the guarantee requires starting this week to complete the full 10-week program before June 2026. Does today or tomorrow work to get enrollment done?"**

**"350 points is a lot — is that realistic?"**
**"Let me show you where the points come from. C&S at 450–500 — push that to 610–670, that's roughly 80 points on R/W. SEC at 450–500 — finite rule set, another 60 points. Advanced Math at 450–500 — function notation and quadratics, another 80 Math points. Geo/Trig at 400–450 — memorizable formula set, another 60. That's 280 points from four targeted fixes. EoI at 550–600 on a 1050 test already proves the ability is there."**

**"Can she handle the workload?"**
**"3–4 hours per week. That's less than one AP class's homework load. The sessions are 1 hour — in and out. The homework is always specific to what showed up in that session, so there's no wasted time."**

**"We tried tutoring before and it didn't work"**
**"What didn't work — was it the tutor, the structure, or the consistency?"** [Listen.] **"The difference here is the program structure. Every session has a specific skill target. There are practice test checkpoints every 3 weeks so we know if the approach is working. And the guarantee means we don't stop until she hits the score."**

---

**"Here's what we do right now:**
1. I send the enrollment link to your email.
2. You complete enrollment today.
3. Alex gets matched with her tutor this week.
4. Session 1 is scheduled for this week.

Phase 1 (Weeks 1–3): C&S and SEC foundation
Phase 2 (Weeks 4–6): Advanced Math and Geometry
Phase 3 (Weeks 7–10): Full integration + test-day prep

June 2026 SAT. Target: 1400.

10 weeks starting this week. I'm sending the link right now — can you pull up your email?"**

[Send link. Walk through enrollment. Get it done on the call.]`;

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
section('TEST 5: buildMeetingScriptDocx — Full Markdown Happy Path');

let scriptBuffer;
try {
  scriptBuffer = await buildMeetingScriptDocx(MOCK_MEETING_SCRIPT_MARKDOWN, 'Alex Johnson');
  assert('buildMeetingScriptDocx returns a Buffer', Buffer.isBuffer(scriptBuffer));
  assert('Meeting script docx is at least 5KB', scriptBuffer.length > 5000);
  assert('Meeting script docx starts with ZIP/DOCX magic bytes', scriptBuffer[0] === 0x50 && scriptBuffer[1] === 0x4B);
  console.log(`     Size: ${(scriptBuffer.length / 1024).toFixed(1)} KB`);
} catch (err) {
  assert('buildMeetingScriptDocx completed without error', false, err.message);
}

// ─── Test 6: buildMeetingScriptDocx — Markdown Edge Cases ────────────────────
section('TEST 6: buildMeetingScriptDocx — Markdown Edge Cases');

// 6a: Minimal markdown (just headers and text)
const minimalMarkdown = `## INTRO (3 min)\n\n**"Hello, how are you?"**\n\n[Wait for response.]`;
try {
  const buf = await buildMeetingScriptDocx(minimalMarkdown, 'Minimal Test');
  assert('buildMeetingScriptDocx handles minimal markdown', Buffer.isBuffer(buf) && buf.length > 3000);
} catch (err) {
  assert('buildMeetingScriptDocx handles minimal markdown', false, err.message);
}

// 6b: Empty string
try {
  const buf = await buildMeetingScriptDocx('', 'Empty Test');
  assert('buildMeetingScriptDocx handles empty string', Buffer.isBuffer(buf));
} catch (err) {
  assert('buildMeetingScriptDocx handles empty string', false, err.message);
}

// 6c: Only stage directions and bullets
const stageOnlyMarkdown = `## Section\n\n[Do this.]\n\n* First bullet\n* Second bullet\n\n[End.]`;
try {
  const buf = await buildMeetingScriptDocx(stageOnlyMarkdown, 'Stage Only');
  assert('buildMeetingScriptDocx handles stage-direction-only sections', Buffer.isBuffer(buf));
} catch (err) {
  assert('buildMeetingScriptDocx handles stage-direction-only sections', false, err.message);
}

// 6d: Numbered list
const numberedMarkdown = `## Close\n\n**"Here's what we do:"**\n\n1. Send the link.\n2. Complete enrollment.\n3. Start this week.`;
try {
  const buf = await buildMeetingScriptDocx(numberedMarkdown, 'Numbered Test');
  assert('buildMeetingScriptDocx handles numbered lists', Buffer.isBuffer(buf));
} catch (err) {
  assert('buildMeetingScriptDocx handles numbered lists', false, err.message);
}

// 6e: Horizontal dividers
const dividerMarkdown = `## Section One\n\nText here.\n\n---\n\n## Section Two\n\nMore text.`;
try {
  const buf = await buildMeetingScriptDocx(dividerMarkdown, 'Divider Test');
  assert('buildMeetingScriptDocx handles horizontal dividers', Buffer.isBuffer(buf));
} catch (err) {
  assert('buildMeetingScriptDocx handles horizontal dividers', false, err.message);
}

// ─── Test 7: API Route Logic (without real Claude) ───────────────────────────
section('TEST 7: API Route Logic Simulation');

// Two-call pipeline: game plan JSON + meeting script markdown separately

// 7a: Game plan JSON parsing (3 formats)
const gamePlanRawOutputs = [
  { label: 'Raw JSON', text: JSON.stringify(MOCK_GAME_PLAN) },
  { label: '```json fenced', text: '```json\n' + JSON.stringify(MOCK_GAME_PLAN) + '\n```' },
  { label: 'Preamble + JSON', text: 'Here is the game plan:\n\n' + JSON.stringify(MOCK_GAME_PLAN) },
];

for (const { label, text } of gamePlanRawOutputs) {
  try {
    let clean = text.trim();
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON found');
    const gamePlan = JSON.parse(match[0]);
    const gpBuf = await buildGamePlanDocx(gamePlan, 'Alex Johnson');
    assert(`Game plan pipeline: ${label}`, Buffer.isBuffer(gpBuf) && gpBuf.length > 10000);
  } catch (err) {
    assert(`Game plan pipeline: ${label}`, false, err.message);
  }
}

// 7b: Meeting script markdown → docx directly
try {
  const sBuf = await buildMeetingScriptDocx(MOCK_MEETING_SCRIPT_MARKDOWN, 'Alex Johnson');
  assert('Meeting script pipeline: markdown → docx', Buffer.isBuffer(sBuf) && sBuf.length > 5000);
} catch (err) {
  assert('Meeting script pipeline: markdown → docx', false, err.message);
}

// 7c: Full parallel pipeline
try {
  const gamePlan = JSON.parse(JSON.stringify(MOCK_GAME_PLAN));
  const [gpBuf, sBuf] = await Promise.all([
    buildGamePlanDocx(gamePlan, 'Alex Johnson'),
    buildMeetingScriptDocx(MOCK_MEETING_SCRIPT_MARKDOWN, 'Alex Johnson'),
  ]);
  assert('Full parallel pipeline: both docs produced', Buffer.isBuffer(gpBuf) && Buffer.isBuffer(sBuf) && gpBuf.length > 10000 && sBuf.length > 5000);
} catch (err) {
  assert('Full parallel pipeline: both docs produced', false, err.message);
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
