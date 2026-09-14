'use strict';

const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic.default({
  apiKey: process.env.ANTHROPIC_API_KEY,
  // Bound retries so a single slow/overloaded extraction can't pile up
  // re-sends of every print and blow past the request budget.
  maxRetries: 1,
});

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

// Hard timeout for the extraction call. Must stay well under the frontend's
// upload timeout so the request always returns: if the AI is slow or the API
// is overloaded, we fail fast and fall back to manual metric entry instead of
// leaving the upload hanging until the client gives up.
const AI_TIMEOUT_MS = 60 * 1000;

const EXTRACTION_PROMPT = `Você é um sistema de extração de métricas de redes sociais.

As imagens fornecidas são DIVERSOS PRINTS DE UM ÚNICO POST. Cada print pode mostrar
métricas diferentes do mesmo post. Analise TODOS os prints em conjunto e CONSOLIDE
os dados em um único conjunto de métricas para esse post.

Extraia TODAS as métricas que conseguir identificar visualmente nos prints — não se
limite aos campos principais abaixo. Qualquer métrica visível (ex: "Não-seguidores
alcançados", "Reproduções", "Tempo médio de visualização", "Seguidores conquistados",
"Duração média assistida", "Cliques no perfil", etc.) deve ser incluída no objeto
"extra" com nomes de chave em português usando snake_case.

MAPEAMENTO OBRIGATÓRIO (terminologia atual do Instagram/Meta) — siga à risca:
- "reach" (Alcance) = SEMPRE o número rotulado como "Contas alcançadas".
  Exemplo: se o print mostra "Contas alcançadas 7.660", então reach = 7660.
- "impressions" (Visualizações) = SEMPRE o número grande rotulado como
  "Visualizações" (o total de views do card "Visualizações", no topo).
  Exemplo: se o print mostra "Visualizações 12.157", então impressions = 12157.
- NUNCA troque os dois: "Visualizações" NÃO é alcance, e "Contas alcançadas"
  NÃO é visualizações. São métricas distintas e quase sempre têm valores
  diferentes (Visualizações costuma ser maior que Contas alcançadas).
- "plays" = reproduções de vídeo/reel, quando rotulado explicitamente como
  "Reproduções". Se a plataforma só mostra "Visualizações" (e não "Reproduções"),
  deixe plays = null e use impressions.
- Em plataformas que ainda usam o rótulo "Impressões", trate "Impressões" como
  impressions.

MÉTRICAS DE STORIES (Instagram) — prints de story mostram rótulos diferentes de
um post de feed. Faça o melhor mapeamento possível para os campos padrão e jogue
o restante em "extra":
- "Contas alcançadas" → reach (igual à regra acima).
- "Compartilhamentos" → shares.
- "Visitas ao perfil" → profile_visits.
- "Toques no link", "Cliques no link" ou "Toques no sticker de link" → link_clicks.
- "Respostas" → comments (respostas ao story contam como comentários aqui).
- "Curtidas" → likes (quando existir).
- Navegação e demais interações de story ("Avançar", "Voltar", "Sair",
  "Próximo story", "Toques no sticker", "Adesivos", etc.) → coloque em "extra"
  com snake_case (ex: {"avancar": 120, "sair": 30, "toques_sticker": 15}).
- Um story normalmente NÃO possui "Visualizações"/"Impressões" nem taxa de
  engajamento; nesses casos deixe esses campos como null em vez de inventar.

PAINEL "INTERAÇÕES" DO STORY (MUITO IMPORTANTE — leia com atenção):
Os prints de story frequentemente têm um painel de detalhamento (um círculo/
donut colorido com o número total de "Interações" no centro, ex: "Interações 20",
seguido de uma LISTA de valores logo abaixo). Essa lista costuma conter, uma por
linha, um rótulo à esquerda e um NÚMERO à direita. Você DEVE ler cada linha dessa
lista e mapear:
- "Curtidas" → likes   (ex.: a linha "Curtidas ....... 17" significa likes = 17)
- "Respostas" → comments
- "Compartilhamentos" → shares
- "Cliques no link" / "Toques no link" → link_clicks
- "Visitas ao perfil" → profile_visits
- "Interações" (o número grande no centro do círculo) → extra.interacoes
- "Seguidores %" / "Não seguidores %" (divisão do alcance) → extra
  (ex.: {"seguidores_pct": 95.0, "nao_seguidores_pct": 5.0})
NÃO confunda o número central "Interações" (total) com "Curtidas": Curtidas é uma
linha específica da lista, quase sempre com valor menor que o total de interações.
Percorra TODA a lista, inclusive linhas separadas por divisórias, e não pare no
primeiro item.

REGRA GERAL: nunca deixe de extrair uma métrica que esteja visível. Se ela não se
encaixar perfeitamente em nenhum campo padrão, ela DEVE aparecer em "extra". Só
retorne null para uma métrica que realmente não aparece em nenhum print.

Regras de consolidação:
- Para cada métrica, use o valor visível em qualquer um dos prints.
- Se a mesma métrica aparecer em mais de um print com valores diferentes, use o valor
  mais claro/legível e registre a divergência em "notes".
- Se uma métrica não estiver visível em nenhum print, retorne null para ela.
- Converta métricas percentuais para número decimal (ex: 4,5% → 4.5).
- Remova formatação de milhar e retorne sempre números puros (12.157 → 12157).

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

  const message = await client.messages.create(
    {
      model: MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [...imageBlocks, { type: 'text', text: EXTRACTION_PROMPT }],
        },
      ],
    },
    { timeout: AI_TIMEOUT_MS }
  );

  return parseAiJson(message.content[0].text);
}

/**
 * Backwards-compatible single-image extraction.
 */
async function extractMetrics(imageBuffer, mimeType) {
  return extractMetricsFromImages([{ buffer: imageBuffer, mimeType }]);
}

/**
 * Lightweight live check: confirms the configured model id is valid and the
 * API key works, without the cost of a real vision extraction call.
 * Used by the admin-only "check AI model" button.
 */
async function pingModel() {
  const startedAt = Date.now();

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ok: false,
      model: MODEL,
      configured_via_env: !!process.env.ANTHROPIC_MODEL,
      error: 'ANTHROPIC_API_KEY não está configurada no servidor',
    };
  }

  try {
    const message = await client.messages.create(
      {
        model: MODEL,
        max_tokens: 4,
        messages: [{ role: 'user', content: 'ping' }],
      },
      { timeout: 15 * 1000 }
    );
    return {
      ok: true,
      model: MODEL,
      configured_via_env: !!process.env.ANTHROPIC_MODEL,
      reported_model: message.model || null,
      latency_ms: Date.now() - startedAt,
    };
  } catch (err) {
    return {
      ok: false,
      model: MODEL,
      configured_via_env: !!process.env.ANTHROPIC_MODEL,
      latency_ms: Date.now() - startedAt,
      error: err.message,
    };
  }
}

module.exports = { extractMetrics, extractMetricsFromImages, pingModel };
