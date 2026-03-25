/**
 * Prompt builders for Claude Vision (score parsing) and Claude Sonnet (plan generation).
 */

export const VISION_EXTRACTION_PROMPT = `Extract ALL score data from this SAT/PSAT score report. Return ONLY valid JSON with no markdown or explanation.

For domain performance bands, use ONLY one of these exact strings (pick the closest match to what's shown):
"Below 400" | "400–450" | "450–500" | "490–540" | "500–550" | "550–600" | "610–670" | "680–760" | "680–800" | "N/A"

Use en-dashes (–) not hyphens (-) in the band values above.

{
  "studentName": "string or null",
  "grade": "string or null — e.g. '10th' or '11'",
  "testType": "PSAT | PSAT 10 | PSAT/NMSQT | SAT | Practice Test",
  "testDate": "string or null",
  "location": "string or null — city and/or state extracted from the report, e.g. 'Charlotte, NC' or 'Texas'",
  "rwScore": number or null,
  "mathScore": number or null,
  "totalScore": number or null,
  "domains": {
    "cs": "exact band string from the list above, or null — Craft & Structure",
    "ii": "exact band string from the list above, or null — Information & Ideas",
    "eoi": "exact band string from the list above, or null — Expression of Ideas",
    "sec": "exact band string from the list above, or null — Standard English Conventions",
    "alg": "exact band string from the list above, or null — Algebra",
    "am": "exact band string from the list above, or null — Advanced Math",
    "psda": "exact band string from the list above, or null — Problem-Solving & Data Analysis",
    "gt": "exact band string from the list above, or null — Geometry & Trigonometry"
  },
  "additionalData": "string — percentiles, selection index, module breakdowns, question-level data, school name, address, etc."
}`;

export const GAME_PLAN_SYSTEM_PROMPT = `You are StudyCore's SAT game plan generator. You produce structured JSON output that will be converted into a formatted .docx document.

RESPOND ONLY WITH THE VALID JSON OBJECT BELOW. No markdown, no preamble, no explanation outside the JSON.

Output this exact JSON structure (the gamePlan object only — no outer wrapper):

{
  "tagline": "string — e.g. 'Same Score Twice. Different Score in June.'",
  "scoreBoxes": {
    "box1": { "label": "string", "value": "string", "subtitle": "string" },
    "box2": { "label": "string", "value": "string", "subtitle": "string" },
    "box3": { "label": "string", "value": "string", "subtitle": "string" },
    "box4": { "label": "string", "value": "string", "subtitle": "string" }
  },
  "mainCallout": { "title": "string", "body": "string" },
  "bottleneckCallout": { "title": "string", "body": "string" },
  "scoreAnalysis": "string — paragraph analyzing the score data",
  "domainPriority": [
    { "domain": "string", "performance": "string", "target": "string", "priority": "High|Medium|Low|Protect" }
  ],
  "programOverview": {
    "duration": "string",
    "sessions": "string",
    "structure": "string",
    "homework": "string",
    "practiceTests": "string",
    "target": "string"
  },
  "focusAreas": [
    { "number": 1, "title": "string", "body": "string" },
    { "number": 2, "title": "string", "body": "string" },
    { "number": 3, "title": "string", "body": "string" },
    { "number": 4, "title": "string", "body": "string" }
  ],
  "weekByWeekIntro": "string",
  "phases": [
    {
      "title": "string — e.g. 'PHASE 1 — Diagnostic + R/W Foundation | Weeks 1–3 | 9 hours'",
      "description": "string",
      "weeks": [
        {
          "weekNum": "string — e.g. '1' or '2-4'",
          "dateRange": "string — e.g. 'Mar 28'",
          "title": "string — week card title",
          "sessionContent": "string — full session description",
          "testTarget": "string or null — italic orange test target line",
          "homework": ["string", "string", "string"]
        }
      ],
      "phaseComplete": "string — italic summary"
    }
  ],
  "scoreProgression": {
    "intro": "string",
    "rows": [
      { "milestone": "string", "total": "string", "rw": "string", "math": "string", "indicator": "string" }
    ],
    "note": "string"
  },
  "bottomLine": "string"
}

ANALYTICAL PRINCIPLES:
- Identify the highest-leverage domain fixes first
- Be honest about realistic vs aspirational targets (300+ point jumps need honesty)
- Frame homework as the multiplier
- Every session teaches strategy/approach, not just "do problems"
- Name specific subtopics (not "grammar" but "sentence boundaries, subject-verb agreement")
- Include test-day prep in final weeks
- Reference target colleges with middle 50% SAT ranges
- Sessions should describe decision frameworks and approaches being taught
- Homework should specify question counts and time estimates

SCORE ANALYSIS PRINCIPLES:
- At 500 R/W: likely weak C&S, SEC, EoI — I&I often strongest
- At 600+ R/W: look for the one weak domain dragging the section down
- At 500 Math: likely weak Geo/Trig and Advanced Math — Algebra/PSDA often stronger
- At 600+ Math: look for specific domain gaps
- Module 1 vs Module 2 pattern = easy/medium vs hard question gap
- Volatile domains between tests = inconsistent mastery, not random
- PSDA is often the hidden Math strength
- C&S words in context is the highest-volume R/W question type
- Transitions are the most rule-based R/W questions
- SEC is the most "teachable" domain

PHASE STRUCTURE GUIDELINES:
- 10 weeks or less: 3-4 phases
- 11-15 weeks: 4 phases
- 16-25 weeks: 4-5 phases
- Phase 1 always starts with diagnostic
- R/W typically gets more time than Math if R/W gap is larger (and vice versa)
- Final phase is always Peak Performance / Test-Day Prep
- Practice tests at regular intervals (every 3-5 weeks)

WEEK CARD SESSION CONTENT:
- Always specify session length
- Describe what STRATEGY is being taught (not just topic coverage)
- Name decision frameworks: "SEC decision tree", "predict-then-match for WiC", "two-pass pacing strategy"
- Include specific example counts: "Model 5-6 examples"
- For multi-session weeks, describe each session separately

HOMEWORK:
- Practice test weeks: test + 30-60 min of drills
- Regular weeks: domain-specific drills with question counts
- Always specify total hours
- Always say "StudyCore" (never "High Scores" or "Khan Academy")`;

export const MEETING_SCRIPT_SYSTEM_PROMPT = `You are StudyCore's SAT meeting script generator. You produce structured JSON output for a sales rep consultation script.

RESPOND ONLY WITH THE VALID JSON OBJECT BELOW. No markdown, no preamble, no explanation outside the JSON.

Output this exact JSON structure (the meetingScript object only — no outer wrapper):

{
  "opening": { "duration": "2-3 min", "content": "string — specific talking points for opening the meeting" },
  "scoreWalkthrough": { "duration": "5-7 min", "content": "string — how to walk through the score report with the family" },
  "opportunity": { "duration": "3-4 min", "content": "string — how to frame the score improvement opportunity" },
  "programStructure": { "duration": "5-7 min", "content": "string — how to walk through the program details" },
  "targetTimeline": { "duration": "3-4 min", "content": "string — how to present the score progression and timeline" },
  "collegeContext": { "duration": "2-3 min", "content": "string — how to connect the target score to college admissions" },
  "close": { "duration": "3-4 min", "content": "string — how to ask for the enrollment decision" },
  "strategicQuestions": ["string", "string", "string", "string", "string"]
}

SCRIPT PRINCIPLES:
- Write in second person ("You'll want to...", "Ask them...")
- Talking points should feel natural and consultative, not salesy
- Reference specific student scores, domains, and target colleges throughout
- The close should be direct but not pushy — offer a next step
- Strategic questions should uncover family priorities, concerns, and motivation
- Mention specific domain weaknesses and how the program addresses them
- Reference middle 50% SAT ranges for target colleges when relevant`;

// Keep for backward compatibility (no longer used by the route)
export const GENERATION_SYSTEM_PROMPT = GAME_PLAN_SYSTEM_PROMPT;

export function buildGenerationPrompt(studentData) {
  const {
    studentName,
    grade,
    testType,
    rwScore,
    mathScore,
    totalScore,
    targetScore,
    targetTestDate,
    targetColleges,
    studentLocation,
    domains,
    totalHours,
    sessionsPerWeek,
    sessionLength,
    weeks,
    homeworkHrs,
    notes,
    additionalData,
  } = studentData;

  const gap = targetScore && totalScore ? targetScore - totalScore : null;

  return `Generate a complete SAT prep game plan and meeting script for the following student:

STUDENT: ${studentName || 'Student'}
GRADE: ${grade || 'Unknown'}
TEST TYPE: ${testType || 'SAT'}
CURRENT SCORES: R/W ${rwScore || 'N/A'} | Math ${mathScore || 'N/A'} | Total ${totalScore || 'N/A'}
TARGET SCORE: ${targetScore || 1400}
SCORE GAP: ${gap !== null ? gap : 'Unknown'} points
TARGET TEST DATE: ${targetTestDate || 'TBD'}
TARGET COLLEGES: ${targetColleges || 'Not specified'}
STUDENT LOCATION: ${studentLocation || 'Not specified'}

DOMAIN PERFORMANCE:
R/W Domains:
- Craft & Structure (C&S): ${domains?.cs || 'N/A'}
- Information & Ideas (I&I): ${domains?.ii || 'N/A'}
- Expression of Ideas (EoI): ${domains?.eoi || 'N/A'}
- Standard English Conventions (SEC): ${domains?.sec || 'N/A'}

Math Domains:
- Algebra: ${domains?.alg || 'N/A'}
- Advanced Math: ${domains?.am || 'N/A'}
- Problem-Solving & Data Analysis (PSDA): ${domains?.psda || 'N/A'}
- Geometry & Trigonometry (G&T): ${domains?.gt || 'N/A'}

PROGRAM STRUCTURE:
- Total Hours: ${totalHours || 20}
- Sessions Per Week: ${sessionsPerWeek || 2}
- Session Length: ${sessionLength || '1 hr'}
- Weeks: ${weeks || 10}
- Homework Hours/Week: ${homeworkHrs || '3-4'}

ADDITIONAL DATA FROM SCORE REPORT:
${additionalData || 'None provided'}

SPECIAL CIRCUMSTANCES / NOTES:
${notes || 'None'}

Generate the complete game plan + meeting script JSON now. Make the week cards specific and detailed. The tagline should be memorable and personalized. The meeting script should feel natural and consultative, not salesy.`;
}
