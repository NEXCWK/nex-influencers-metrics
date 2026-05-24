'use strict';

const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic.default({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = 'claude-sonnet-4-20250514';

const EXTRACTION_PROMPT = `Você é um sistema de extração de métricas de redes sociais.
Analise o print de métricas fornecido e extraia APENAS os dados numéricos visíveis.
Retorne SOMENTE um JSON válido, sem markdown, sem explicação, no seguinte formato:

{
  "reach": null,
  "impressions": null,
  "likes": null,
  "comments": null,
  "shares": null,
  "saves": null,
  "plays": null,
  "engagement_rate": null,
  "profile_visits": null,
  "link_clicks": null,
  "platform_detected": null,
  "confidence": "high|medium|low",
  "notes": ""
}

Se um campo não estiver visível no print, retorne null para esse campo.
Se detectar a plataforma pelo visual, informe em platform_detected.
Se houver ambiguidade em algum valor, registre em notes.`;

/**
 * Extracts social media metrics from an image using Claude.
 *
 * @param {Buffer} imageBuffer - Raw image bytes.
 * @param {string} mimeType - e.g. 'image/jpeg', 'image/png', 'image/webp'
 * @returns {Promise<Object>} Parsed metrics object.
 */
async function extractMetrics(imageBuffer, mimeType) {
  const base64Image = imageBuffer.toString('base64');

  // Ensure mimeType is one Claude supports for vision
  const supportedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const effectiveMimeType = supportedMimeTypes.includes(mimeType) ? mimeType : 'image/jpeg';

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: effectiveMimeType,
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: EXTRACTION_PROMPT,
          },
        ],
      },
    ],
  });

  const rawText = message.content[0].text.trim();

  // Strip any accidental markdown code fences Claude might add
  const jsonText = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (parseErr) {
    console.error('Failed to parse Claude JSON response:', rawText);
    throw new Error(`AI response was not valid JSON: ${parseErr.message}`);
  }

  return parsed;
}

module.exports = { extractMetrics };
