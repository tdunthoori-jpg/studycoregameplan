import Anthropic from '@anthropic-ai/sdk';
import { GENERATION_SYSTEM_PROMPT, buildGenerationPrompt } from '../../../lib/prompts';
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

        // ── Step 1: Call Claude (streaming to keep connection alive) ──────────
        let rawText = '';
        let stopReason = null;
        try {
          const claudeStream = client.messages.stream({
            model: 'claude-sonnet-4-6',
            max_tokens: 16000,
            system: GENERATION_SYSTEM_PROMPT,
            messages: [{ role: 'user', content: buildGenerationPrompt(studentData) }],
          });

          // Send a heartbeat every 15 seconds while Claude streams
          let lastHeartbeat = Date.now();
          for await (const chunk of claudeStream) {
            if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
              rawText += chunk.delta.text;
            }
            if (chunk.type === 'message_delta' && chunk.delta?.stop_reason) {
              stopReason = chunk.delta.stop_reason;
            }
            const now = Date.now();
            if (now - lastHeartbeat > 15000) {
              lastHeartbeat = now;
              line(controller, { status: 'generating', message: `Claude is writing… (~${Math.round(rawText.length / 4)} tokens so far)` });
            }
          }
        } catch (err) {
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

        // Detect truncation before attempting to parse
        if (stopReason === 'max_tokens') {
          line(controller, { status: 'error', error: 'Claude response was cut off (too long). Try reducing the number of weeks or sessions, then generate again.' });
          controller.close();
          return;
        }

        // ── Step 2: Parse JSON ─────────────────────────────────────────────────
        // Strip markdown code fences if Claude wrapped the response
        let cleanText = rawText.trim();
        if (cleanText.startsWith('```')) {
          cleanText = cleanText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
        }

        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          line(controller, { status: 'error', error: 'Claude did not return valid JSON. Try generating again.', raw: rawText.slice(0, 500) });
          controller.close();
          return;
        }

        let parsed;
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch (parseErr) {
          // Include the tail of the raw text to help diagnose truncation
          line(controller, { status: 'error', error: 'JSON parse error — the response may have been cut off. Try generating again.', raw: rawText.slice(-300) });
          controller.close();
          return;
        }

        const { gamePlan, meetingScript } = parsed;
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
