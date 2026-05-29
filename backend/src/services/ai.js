'use strict';

const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic.default({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';

const EXTRACTION_PROMPT = `Você é um sistema de extração de métricas de redes sociais.

As imagens fornecidas são DIVERSOS PRINTS DE UM ÚNICO POST. Cada print pode mostrar
métricas diferentes do mesmo post. Analise TODOS os prints em conjunto e CONSOLIDE
os dados em um único conjunto de métricas para esse post.

Extraia TODAS as métricas que conseguir identificar visualmente nos prints — não se
limite aos campos principais abaixo. Qualquer métrica visível (ex: "Não-seguidores
alcançados", "Reproduções", "Tempo médio de visualização", "Seguidores conquistados",
"Duração média assistida", "Cliques no perfil", etc.) deve ser incluída no objeto
"extra" com nomes de chave em português usando snake_case.

Regras de consolidação:
- Para cada métrica, use o valor visível em qualquer um dos prints.
- Se a mesma métrica aparecer em mais de um print com valores diferentes, use o valor
  mais claro/legível e registre a divergência em "notes".
- Se uma métrica não estiver visível em nenhum print, retorne null para ela.
- Converta métricas percentuais para número decimal (ex: 4,5% → 4.5).
- Remova formatação de milhar e retorne sempre números puros.

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
  "extra": {},
  "platform_detected": null,
  "confidence": "high|medium|low",
  "notes": ""
}

O campo "extra" deve conter quaisquer outras métricas visíveis nos prints que não
se encaixem nos campos principais acima, ex:
{"nao_seguidores_alcancados": 850, "tempo_medio_video": "0:45", "seguidores_conquistados": 12}.

Se detectar a plataforma pelo visual, informe em platform_detected.
Se houver ambiguidade em algum valor, registre em notes.`;

const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

function parseAiJson(rawText) {
  const jsonText = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  try {
    return JSON.parse(jsonText);
  } catch (parseErr) {
    console.error('Failed to parse Claude JSON response:', rawText);
    throw new Error(`AI response was not valid JSON: ${parseErr.message}`);
  }
}

/**
 * Extracts and consolidates social media metrics from one or more screenshots
 * that all belong to the SAME post.
 *
 * @param {Array<{buffer: Buffer, mimeType: string}>} images
 * @returns {Promise<Object>} Parsed (consolidated) metrics object.
 */
async function extractMetricsFromImages(images) {
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error('extractMetricsFromImages requires at least one image');
  }

  const imageBlocks = images.map(({ buffer, mimeType }) => ({
    type: 'image',
    source: {
      type: 'base64',
      media_type: SUPPORTED_MIME_TYPES.includes(mimeType) ? mimeType : 'image/jpeg',
      data: buffer.toString('base64'),
    },
  }));

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [...imageBlocks, { type: 'text', text: EXTRACTION_PROMPT }],
      },
    ],
  });

  return parseAiJson(message.content[0].text);
}

/**
 * Backwards-compatible single-image extraction.
 */
async function extractMetrics(imageBuffer, mimeType) {
  return extractMetricsFromImages([{ buffer: imageBuffer, mimeType }]);
}

module.exports = { extractMetrics, extractMetricsFromImages };
