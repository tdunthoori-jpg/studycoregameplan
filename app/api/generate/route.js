import Anthropic from '@anthropic-ai/sdk';
import {
  GAME_PLAN_SYSTEM_PROMPT, MEETING_SCRIPT_SYSTEM_PROMPT, buildGenerationPrompt, buildGamePlanPrompt,
  ACT_GAME_PLAN_SYSTEM_PROMPT, ACT_MEETING_SCRIPT_SYSTEM_PROMPT, buildACTGamePlanPrompt, buildACTGenerationPrompt,
} from '../../../lib/prompts';
import { buildGamePlanPdf } from '../../../lib/pdf-game-plan';
import { buildMeetingScriptPdf } from '../../../lib/pdf-script';
import { buildPresentationBoth } from '../../../lib/pdf-presentation';

export const maxDuration = 300;

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  const encoder = new TextEncoder();

  // Helper: send a newline-delimited JSON line
  function line(controller, obj) {
    controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // ── Validate ────────────────────────────────────────────────────────────
        if (!apiKey) {
          line(controller, { status: 'error', error: 'ANTHROPIC_API_KEY is not set on the server. Add it in Vercel → Settings → Environment Variables.' });
          return;
        }

        let studentData;
        try {
          studentData = await request.json();
        } catch {
          line(controller, { status: 'error', error: 'Invalid request body.' });
          return;
        }

        // ── Step 1: Pre-generation validation ───────────────────────────────────
        const missingFields = [];
        const isACT = (studentData.testType || '').toUpperCase() === 'ACT';

        const { totalScore, rwScore, mathScore, targetScore, domains } = studentData;

        if (isACT) {
          // ACT validation: need composite (or all 4 sections) + target
          const hasComposite = !!totalScore;
          const hasSections  = !!(domains?.actEnglish && domains?.actMath && domains?.actReading && domains?.actScience);
          if (!hasComposite && !hasSections) missingFields.push('ACT composite or all four section scores (English, Math, Reading, Science)');
          if (!targetScore) missingFields.push('targetScore (ACT target composite)');
        } else {
          // SAT/PSAT validation: need total/sections + all 8 domains
          if (!totalScore && !(rwScore && mathScore)) missingFields.push('currentScore (totalScore or rwScore+mathScore)');
          if (!targetScore) missingFields.push('targetScore');

          const domainMap = {
            'domains.ii  (Information & Ideas)': domains?.ii,
            'domains.cs  (Craft & Structure)': domains?.cs,
            'domains.eoi (Expression of Ideas)': domains?.eoi,
            'domains.sec (Standard English Conventions)': domains?.sec,
            'domains.alg (Algebra)': domains?.alg,
            'domains.am  (Advanced Math)': domains?.am,
            'domains.psda (Problem-Solving & Data Analysis)': domains?.psda,
            'domains.gt  (Geometry & Trigonometry)': domains?.gt,
          };
          for (const [label, val] of Object.entries(domainMap)) {
            if (!val || val === 'N/A') missingFields.push(label);
          }
        }

        if (missingFields.length > 0) {
          line(controller, {
            status: 'error',
            error: `Cannot generate — the following required fields are missing:\n• ${missingFields.join('\n• ')}`,
          });
          return;
        }

        // Pricing is optional — script will omit Section 7 if blank (no error)

        // Send immediate heartbeat so the connection isn't dropped
        line(controller, { status: 'generating', message: 'Calling Claude Sonnet — this takes 30–90 seconds…' });

        const client = new Anthropic({ apiKey });

        // Route to ACT or SAT prompts
        const gamePlanSystemPrompt = isACT ? ACT_GAME_PLAN_SYSTEM_PROMPT   : GAME_PLAN_SYSTEM_PROMPT;
        const scriptSystemPrompt   = isACT ? ACT_MEETING_SCRIPT_SYSTEM_PROMPT : MEETING_SCRIPT_SYSTEM_PROMPT;
        const gamePlanPrompt       = isACT ? buildACTGamePlanPrompt(studentData)   : buildGamePlanPrompt(studentData);
        const scriptPrompt         = isACT ? buildACTGenerationPrompt(studentData) : buildGenerationPrompt(studentData);

        // ── Step 1: Call Claude twice in parallel (game plan + meeting script) ─
        // Running in parallel halves the wait time and keeps each response
        // well within token limits regardless of plan length.
        line(controller, { status: 'generating', message: 'Building game plan and meeting script in parallel…' });

        // Heartbeat every 12 seconds so Vercel doesn't drop the connection
        let elapsed = 0;
        const heartbeat = setInterval(() => {
          elapsed += 12;
          line(controller, { status: 'generating', message: `Claude is working… (${elapsed}s)` });
        }, 12000);

        let gamePlanMsg, scriptMsg;
        try {
          [gamePlanMsg, scriptMsg] = await Promise.all([
            client.messages.create({
              model: 'claude-sonnet-4-6',
              max_tokens: 64000,
              system: gamePlanSystemPrompt,
              messages: [{ role: 'user', content: gamePlanPrompt }],
            }),
            client.messages.create({
              model: 'claude-sonnet-4-6',
              max_tokens: 16000,
              temperature: 0.3,
              system: scriptSystemPrompt,
              messages: [{ role: 'user', content: scriptPrompt }],
            }),
          ]);
        } catch (err) {
          clearInterval(heartbeat);
          const msg = err?.message ?? 'Unknown Anthropic API error';
          const hint = err?.status === 401
            ? ' — Check that your ANTHROPIC_API_KEY is valid.'
            : err?.status === 429
            ? ' — Rate limit hit; wait a moment and try again.'
            : '';
          line(controller, { status: 'error', error: `Claude API error: ${msg}${hint}` });
          return;
        }
        clearInterval(heartbeat);

        // Check for truncation in either response
        if (gamePlanMsg.stop_reason === 'max_tokens') {
          line(controller, { status: 'error', error: 'Game plan response was cut off. Try reducing the number of weeks, then generate again.' });
          return;
        }
        if (scriptMsg.stop_reason === 'max_tokens') {
          line(controller, { status: 'error', error: 'Meeting script response was cut off. Try generating again.' });
          return;
        }

        // ── Step 2: Parse game plan JSON; meeting script is raw markdown ───────

        // Fix the most common ways Claude produces malformed JSON:
        // 1. Literal (unescaped) newlines / tabs / carriage-returns inside strings
        // 2. Trailing commas before } or ]
        // 3. Curly/smart quotes instead of straight ASCII quotes
        function repairJson(str) {
          // Pass 1: walk character-by-character to escape control chars inside strings
          let inString = false;
          let escaped  = false;
          let out      = '';
          for (let i = 0; i < str.length; i++) {
            const ch = str[i];
            if (escaped) { out += ch; escaped = false; continue; }
            if (ch === '\\' && inString) { out += ch; escaped = true; continue; }
            if (ch === '"') { out += ch; inString = !inString; continue; }
            if (inString) {
              if      (ch === '\n') { out += '\\n';  continue; }
              else if (ch === '\r') { out += '\\r';  continue; }
              else if (ch === '\t') { out += '\\t';  continue; }
              // Replace smart/curly quotes that occasionally appear in strings
              else if (ch === '“' || ch === '”') { out += '"'; continue; }
              else if (ch === '‘' || ch === '’') { out += "'"; continue; }
            }
            out += ch;
          }
          // Pass 2: strip trailing commas before } or ]
          return out.replace(/,(\s*[}\]])/g, '$1');
        }

        function parseJson(rawText, label) {
          let clean = rawText.trim();
          // Strip markdown code fences
          if (clean.startsWith('```')) {
            clean = clean.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
          }
          const match = clean.match(/\{[\s\S]*\}/);
          if (!match) throw new Error(`${label}: no JSON object found in response`);
          const jsonStr = match[0];
          // First try straight parse; on failure, attempt repair then retry
          try {
            return JSON.parse(jsonStr);
          } catch (firstErr) {
            try {
              return JSON.parse(repairJson(jsonStr));
            } catch {
              throw firstErr; // surface the original error message
            }
          }
        }

        let gamePlan;
        try {
          gamePlan = parseJson(gamePlanMsg.content[0].text, 'Game plan');
        } catch (err) {
          line(controller, { status: 'error', error: `Game plan parse error: ${err.message}. Try generating again.` });
          return;
        }

        if (!gamePlan) {
          line(controller, { status: 'error', error: 'Claude response missing game plan data.' });
          return;
        }

        // Meeting script is markdown text — use directly
        const meetingScriptMarkdown = scriptMsg.content[0].text.trim();

        // ── Step 3: Build PDFs ─────────────────────────────────────────────────
        line(controller, { status: 'building', message: 'Building PDF files…' });

        const studentName = studentData.studentName || 'Student';
        let gamePlanBuffer, scriptBuffer, presentationBuffer, pptxBuffer;
        try {
          // buildPresentationBoth shares one Chromium instance for PDF + PPTX
          let presResult;
          [gamePlanBuffer, scriptBuffer, presResult] = await Promise.all([
            buildGamePlanPdf(gamePlan, studentName),
            buildMeetingScriptPdf(meetingScriptMarkdown, studentName),
            buildPresentationBoth(gamePlan, studentData, studentName),
          ]);
          presentationBuffer = presResult.pdfBuffer;
          pptxBuffer         = presResult.pptxBuffer;
        } catch (err) {
          line(controller, { status: 'error', error: `Document build error: ${err.message}` });
          return;
        }

        // ── Step 4: Send result ────────────────────────────────────────────────
        line(controller, {
          status: 'done',
          gamePlanBase64:      Buffer.from(gamePlanBuffer).toString('base64'),
          scriptBase64:        Buffer.from(scriptBuffer).toString('base64'),
          presentationBase64:  Buffer.from(presentationBuffer).toString('base64'),
          pptxBase64:          Buffer.from(pptxBuffer).toString('base64'),
          studentName,
        });

      } catch (err) {
        // Catch-all for any unhandled errors
        try {
          line(controller, { status: 'error', error: `Unexpected error: ${err?.message ?? String(err)}` });
        } catch {}
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no', // Disable nginx buffering for streaming
    },
  });
}
