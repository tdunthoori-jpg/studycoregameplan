import Anthropic from '@anthropic-ai/sdk';
import {
  GAME_PLAN_SYSTEM_PROMPT, buildGamePlanPrompt,
  ACT_GAME_PLAN_SYSTEM_PROMPT, buildACTGamePlanPrompt,
} from '../../../lib/prompts';
import { buildGamePlanPdf } from '../../../lib/pdf-game-plan';
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
      // Declare heartbeat OUTSIDE the try block so catch/finally can access it.
      // const inside try is block-scoped to try and invisible to catch/finally.
      let heartbeat;

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

        // Send immediate heartbeat so the connection isn't dropped
        line(controller, { status: 'generating', message: 'Calling Claude Sonnet — this takes 30–90 seconds…' });

        const client = new Anthropic({ apiKey });

        const gamePlanSystemPrompt = isACT ? ACT_GAME_PLAN_SYSTEM_PROMPT : GAME_PLAN_SYSTEM_PROMPT;
        const gamePlanPrompt       = isACT ? buildACTGamePlanPrompt(studentData) : buildGamePlanPrompt(studentData);

        line(controller, { status: 'generating', message: 'Building game plan…' });

        // Heartbeat every 10 seconds for the entire request lifetime — covers both
        // the Claude API call and the Puppeteer PDF build, either of which can exceed
        // 30s and cause CDN/proxy to drop an idle stream.
        let elapsed = 0;
        let heartbeatPhase = 'generating';
        heartbeat = setInterval(() => {
          elapsed += 10;
          try {
            line(controller, { status: heartbeatPhase, message: `${heartbeatPhase === 'building' ? 'Building PDFs' : 'Claude is working'}… (${elapsed}s)` });
          } catch {
            // Controller may already be closed — suppress to avoid unhandled errors
            clearInterval(heartbeat);
          }
        }, 10000);

        // Helper: always clear heartbeat + send terminal line before returning
        function bail(obj) {
          clearInterval(heartbeat);
          line(controller, obj);
        }

        let gamePlanMsg;
        try {
          gamePlanMsg = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 64000,
            temperature: 0,
            system: gamePlanSystemPrompt,
            messages: [{ role: 'user', content: gamePlanPrompt }],
          });
        } catch (err) {
          const msg = err?.message ?? 'Unknown Anthropic API error';
          const hint = err?.status === 401
            ? ' — Check that your ANTHROPIC_API_KEY is valid.'
            : err?.status === 429
            ? ' — Rate limit hit; wait a moment and try again.'
            : '';
          bail({ status: 'error', error: `Claude API error: ${msg}${hint}` });
          return;
        }

        if (gamePlanMsg.stop_reason === 'max_tokens') {
          bail({ status: 'error', error: 'Game plan response was cut off. Try reducing the number of weeks, then generate again.' });
          return;
        }

        // ── Step 2: Parse game plan JSON ─────────────────────────────────────────

        function repairJson(str) {
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
              else if (ch === '“' || ch === '”') { out += '"'; continue; }
              else if (ch === '‘' || ch === '’') { out += "'"; continue; }
            }
            out += ch;
          }
          return out.replace(/,(\s*[}\]])/g, '$1');
        }

        function parseJson(rawText, label) {
          let clean = rawText.trim();
          if (clean.startsWith('```')) {
            clean = clean.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
          }
          const match = clean.match(/\{[\s\S]*\}/);
          if (!match) throw new Error(`${label}: no JSON object found in response`);
          const jsonStr = match[0];
          try {
            return JSON.parse(jsonStr);
          } catch (firstErr) {
            try {
              return JSON.parse(repairJson(jsonStr));
            } catch {
              throw firstErr;
            }
          }
        }

        let gamePlan;
        try {
          gamePlan = parseJson(gamePlanMsg.content[0].text, 'Game plan');
        } catch (err) {
          bail({ status: 'error', error: `Game plan parse error: ${err.message}. Try generating again.` });
          return;
        }

        if (!gamePlan) {
          bail({ status: 'error', error: 'Claude response missing game plan data.' });
          return;
        }

        // ── Step 3: Build PDFs ─────────────────────────────────────────────────
        heartbeatPhase = 'building';
        line(controller, { status: 'building', message: 'Building PDF files…' });

        const studentName = studentData.studentName || 'Student';
        let gamePlanBuffer, presentationBuffer, pptxBuffer;
        try {
          // Sequential — not parallel — to avoid peak memory from running
          // Puppeteer + React PDF renderer simultaneously on Vercel.
          gamePlanBuffer = await buildGamePlanPdf(gamePlan, studentData, studentName);
          const presResult = await buildPresentationBoth(gamePlan, studentData, studentName);
          presentationBuffer = presResult.pdfBuffer;
          pptxBuffer         = presResult.pptxBuffer;
        } catch (err) {
          bail({ status: 'error', error: `Document build error: ${err.message}` });
          return;
        }
        clearInterval(heartbeat);

        // ── Step 4: Send result ────────────────────────────────────────────────
        line(controller, {
          status: 'done',
          gamePlanBase64:     Buffer.from(gamePlanBuffer).toString('base64'),
          presentationBase64: Buffer.from(presentationBuffer).toString('base64'),
          pptxBase64:         Buffer.from(pptxBuffer).toString('base64'),
          studentName,
        });

      } catch (err) {
        clearInterval(heartbeat);
        try {
          line(controller, { status: 'error', error: `Unexpected error: ${err?.message ?? String(err)}` });
        } catch {}
      } finally {
        clearInterval(heartbeat); // belt-and-suspenders: safe to call after already cleared
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}
