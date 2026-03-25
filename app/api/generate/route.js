import Anthropic from '@anthropic-ai/sdk';
import { GENERATION_SYSTEM_PROMPT, buildGenerationPrompt } from '../../../lib/prompts';
import { buildGamePlanDocx } from '../../../lib/docx-builder';
import { buildMeetingScriptDocx } from '../../../lib/script-builder';

export const maxDuration = 120;

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY is not set' }, { status: 500 });
  }

  let studentData;
  try {
    studentData = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!studentData.studentName && !studentData.totalScore) {
    return Response.json({ error: 'Missing required student data' }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  // ── Step 1: Call Claude Sonnet ───────────────────────────────────────────────
  let claudeResponse;
  try {
    claudeResponse = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: GENERATION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: buildGenerationPrompt(studentData),
        },
      ],
    });
  } catch (err) {
    console.error('Claude API error:', err);
    return Response.json(
      { error: `Anthropic API error: ${err.message ?? 'Unknown error'}` },
      { status: err.status ?? 502 }
    );
  }

  const rawText = claudeResponse.content[0]?.text ?? '';

  // ── Step 2: Parse JSON ───────────────────────────────────────────────────────
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return Response.json(
      { error: 'Claude did not return valid JSON', raw: rawText.slice(0, 500) },
      { status: 422 }
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    return Response.json(
      { error: 'JSON parse error', raw: rawText.slice(0, 500) },
      { status: 422 }
    );
  }

  const { gamePlan, meetingScript } = parsed;
  if (!gamePlan || !meetingScript) {
    return Response.json(
      { error: 'Missing gamePlan or meetingScript in response', raw: rawText.slice(0, 500) },
      { status: 422 }
    );
  }

  const studentName = studentData.studentName || 'Student';

  // ── Step 3: Build .docx files ────────────────────────────────────────────────
  let gamePlanBuffer, scriptBuffer;
  try {
    [gamePlanBuffer, scriptBuffer] = await Promise.all([
      buildGamePlanDocx(gamePlan, studentName),
      buildMeetingScriptDocx(meetingScript, studentName),
    ]);
  } catch (err) {
    console.error('docx build error:', err);
    return Response.json({ error: `Document build error: ${err.message}` }, { status: 500 });
  }

  // ── Step 4: Return as JSON with base64-encoded files ─────────────────────────
  return Response.json({
    success: true,
    gamePlanBase64: Buffer.from(gamePlanBuffer).toString('base64'),
    scriptBase64:   Buffer.from(scriptBuffer).toString('base64'),
    studentName,
  });
}
