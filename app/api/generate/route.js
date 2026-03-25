import Anthropic from '@anthropic-ai/sdk';
import { GAME_PLAN_SYSTEM_PROMPT, MEETING_SCRIPT_SYSTEM_PROMPT, buildGenerationPrompt } from '../../../lib/prompts';
import { buildGamePlanDocx } from '../../../lib/docx-builder';
import { buildMeetingScriptDocx } from '../../../lib/script-builder';

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
              max_tokens: 4000,
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

        // ── Step 2: Parse JSON from each response ──────────────────────────────
        function parseJson(rawText, label) {
          let clean = rawText.trim();
          if (clean.startsWith('```')) {
            clean = clean.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
          }
          const match = clean.match(/\{[\s\S]*\}/);
          if (!match) throw new Error(`${label}: no JSON object found in response`);
          return JSON.parse(match[0]);
        }

        let gamePlan, meetingScript;
        try {
          gamePlan = parseJson(gamePlanMsg.content[0].text, 'Game plan');
        } catch (err) {
          line(controller, { status: 'error', error: `Game plan parse error: ${err.message}. Try generating again.` });
          controller.close();
          return;
        }
        try {
          meetingScript = parseJson(scriptMsg.content[0].text, 'Meeting script');
        } catch (err) {
          line(controller, { status: 'error', error: `Meeting script parse error: ${err.message}. Try generating again.` });
          controller.close();
          return;
        }

        if (!gamePlan || !meetingScript) {
          line(controller, { status: 'error', error: 'Claude response missing gamePlan or meetingScript sections.' });
          controller.close();
          return;
        }

        // ── Step 3: Build .docx ────────────────────────────────────────────────
        line(controller, { status: 'building', message: 'Building .docx files…' });

        const studentName = studentData.studentName || 'Student';
        let gamePlanBuffer, scriptBuffer;
        try {
          [gamePlanBuffer, scriptBuffer] = await Promise.all([
            buildGamePlanDocx(gamePlan, studentName),
            buildMeetingScriptDocx(meetingScript, studentName),
          ]);
        } catch (err) {
          line(controller, { status: 'error', error: `Document build error: ${err.message}` });
          controller.close();
          return;
        }

        // ── Step 4: Send result ────────────────────────────────────────────────
        line(controller, {
          status: 'done',
          gamePlanBase64: Buffer.from(gamePlanBuffer).toString('base64'),
          scriptBase64:   Buffer.from(scriptBuffer).toString('base64'),
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
