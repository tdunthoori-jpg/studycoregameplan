import Anthropic from '@anthropic-ai/sdk';
import { GAME_PLAN_SYSTEM_PROMPT, MEETING_SCRIPT_SYSTEM_PROMPT, buildGenerationPrompt } from '../../../lib/prompts';
import { buildGamePlanPdf } from '../../../lib/pdf-game-plan';
import { buildMeetingScriptPdf } from '../../../lib/pdf-script';
import { buildPresentationPdf } from '../../../lib/pdf-presentation';

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
          controller.close();
          return;
        }

        let studentData;
        try {
          studentData = await request.json();
        } catch {
          line(controller, { status: 'error', error: 'Invalid request body.' });
          controller.close();
          return;
        }

        // ── Step 1: Pre-generation validation ───────────────────────────────────
        const missingFields = [];

        // Required score fields
        const { totalScore, rwScore, mathScore, targetScore, domains } = studentData;
        if (!totalScore && !(rwScore && mathScore)) missingFields.push('currentScore (totalScore or rwScore+mathScore)');
        if (!targetScore) missingFields.push('targetScore');

        // All 8 domain scores required
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

        if (missingFields.length > 0) {
          line(controller, {
            status: 'error',
            error: `Cannot generate script — the following required fields are missing from the Game Plan:\n• ${missingFields.join('\n• ')}`,
          });
          controller.close();
          return;
        }

        // Pricing is optional — script will omit Section 7 if blank (no error)

        // Send immediate heartbeat so the connection isn't dropped
        line(controller, { status: 'generating', message: 'Calling Claude Sonnet — this takes 30–90 seconds…' });

        const client = new Anthropic({ apiKey });
        const userPrompt = buildGenerationPrompt(studentData);

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
              max_tokens: 16000,
              system: GAME_PLAN_SYSTEM_PROMPT,
              messages: [{ role: 'user', content: userPrompt }],
            }),
            client.messages.create({
              model: 'claude-sonnet-4-6',
              max_tokens: 16000,
              temperature: 0.3,
              system: MEETING_SCRIPT_SYSTEM_PROMPT,
              messages: [{ role: 'user', content: userPrompt }],
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
          controller.close();
          return;
        }
        clearInterval(heartbeat);

        // Check for truncation in either response
        if (gamePlanMsg.stop_reason === 'max_tokens') {
          line(controller, { status: 'error', error: 'Game plan response was cut off. Try reducing the number of weeks, then generate again.' });
          controller.close();
          return;
        }
        if (scriptMsg.stop_reason === 'max_tokens') {
          line(controller, { status: 'error', error: 'Meeting script response was cut off. Try generating again.' });
          controller.close();
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
          controller.close();
          return;
        }

        if (!gamePlan) {
          line(controller, { status: 'error', error: 'Claude response missing game plan data.' });
          controller.close();
          return;
        }

        // Meeting script is markdown text — use directly
        const meetingScriptMarkdown = scriptMsg.content[0].text.trim();

        // ── Step 3: Build PDFs ─────────────────────────────────────────────────
        line(controller, { status: 'building', message: 'Building PDF files…' });

        const studentName = studentData.studentName || 'Student';
        let gamePlanBuffer, scriptBuffer, presentationBuffer;
        try {
          [gamePlanBuffer, scriptBuffer, presentationBuffer] = await Promise.all([
            buildGamePlanPdf(gamePlan, studentName),
            buildMeetingScriptPdf(meetingScriptMarkdown, studentName),
            buildPresentationPdf(gamePlan, studentData, studentName),
          ]);
        } catch (err) {
          line(controller, { status: 'error', error: `Document build error: ${err.message}` });
          controller.close();
          return;
        }

        // ── Step 4: Send result ────────────────────────────────────────────────
        line(controller, {
          status: 'done',
          gamePlanBase64:      Buffer.from(gamePlanBuffer).toString('base64'),
          scriptBase64:        Buffer.from(scriptBuffer).toString('base64'),
          presentationBase64:  Buffer.from(presentationBuffer).toString('base64'),
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
