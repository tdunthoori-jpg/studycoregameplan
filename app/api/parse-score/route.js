import Anthropic from '@anthropic-ai/sdk';
import { VISION_EXTRACTION_PROMPT } from '../../../lib/prompts';

export const maxDuration = 60;

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'API key not configured' }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { fileData, mediaType } = body;
  if (!fileData || !mediaType) {
    return Response.json({ error: 'Missing fileData or mediaType' }, { status: 400 });
  }

  // Validate media type
  const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(mediaType)) {
    return Response.json({ error: `Unsupported file type: ${mediaType}` }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  try {
    let messageContent;

    if (mediaType === 'application/pdf') {
      // Use document block for PDFs
      messageContent = [
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: fileData,
          },
        },
        {
          type: 'text',
          text: VISION_EXTRACTION_PROMPT,
        },
      ];
    } else {
      // Use image block for images
      messageContent = [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: fileData,
          },
        },
        {
          type: 'text',
          text: VISION_EXTRACTION_PROMPT,
        },
      ];
    }

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: messageContent,
        },
      ],
    });

    const rawText = response.content[0]?.text ?? '';

    // Extract JSON from response (strip any accidental markdown fences)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({ error: 'Could not extract JSON from response', raw: rawText }, { status: 422 });
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      return Response.json({ error: 'Malformed JSON in response', raw: rawText }, { status: 422 });
    }

    return Response.json({ success: true, data: parsed });
  } catch (err) {
    console.error('parse-score error:', err);
    const status = err.status ?? 500;
    return Response.json({ error: err.message ?? 'Anthropic API error' }, { status });
  }
}
