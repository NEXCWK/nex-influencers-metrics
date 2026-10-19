'use strict';

const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic.default({
  apiKey: process.env.ANTHROPIC_API_KEY,
  // Bound retries so a single slow/overloaded extraction can't pile up
  // re-sends of every print and blow past the request budget.
  maxRetries: 1,
});

// Opus for maximum visual-reading precision (small numbers/labels on
// screenshots) — a deliberate accuracy-over-cost tradeoff, requested after
// Sonnet extractions were missing/misreading metrics.
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5';

// Hard timeout for the extraction call. Must stay well under the frontend's
// upload timeout so the request always returns: if the AI is slow or the API
// is overloaded, we fail fast and fall back to manual metric entry instead of
// leaving the upload hanging until the client gives up. Opus is slower than
// Sonnet, so this has more headroom than before.
const AI_TIMEOUT_MS = 90 * 1000;

function buildExtractionPrompt(imageCount) {
  return `Você é um sistema de extração de métricas de redes sociais.

Você recebeu ${imageCount} imagem${imageCount !== 1 ? 's' : ''} nesta mensagem — TODAS são
prints de UM ÚNICO POST (não pule nenhuma). Examine CADA UMA das ${imageCount}
imagens individualmente, uma por uma, antes de consolidar: é comum que métricas
diferentes apareçam em prints diferentes (ex.: o 1º print mostra Alcance/Curtidas
e o 2º mostra Visitas ao perfil/Cliques no link). Ignorar qualquer imagem além da
primeira é um erro grave. Depois de examinar todas, CONSOLIDE os dados em um único
conjunto de métricas para esse post.

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

"profile_visits" (Visitas ao perfil) — SEMPRE que APARECER em QUALQUER print
(feed ou story), extraia esse valor, mesmo que os outros campos principais já
estejam preenchidos. Variações de rótulo a procurar: "Visitas ao perfil",
"Perfil visitado", "Visualizações do perfil", "Toques no perfil", "Visitas de
perfil". Se aparecer em mais de um print, use o mais legível.

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
}

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

  // Interleave a "Print N:" label before each image — this measurably helps
  // Claude ground its reasoning per-image instead of skimming only the first
  // one, especially important now that a post can carry up to 10 prints.
  const imageBlocks = images.flatMap(({ buffer, mimeType }, i) => [
    { type: 'text', text: `Print ${i + 1} de ${images.length}:` },
    {
      type: 'image',
      source: {
        type: 'base64',
        media_type: SUPPORTED_MIME_TYPES.includes(mimeType) ? mimeType : 'image/jpeg',
        data: buffer.toString('base64'),
      },
    },
  ]);

  const message = await client.messages.create(
    {
      model: MODEL,
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [...imageBlocks, { type: 'text', text: buildExtractionPrompt(images.length) }],
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

// ---------------------------------------------------------------------------
// classifyAndExtractBatch — NEW upload flow: every print is its OWN post.
// Unlike extractMetricsFromImages above (kept as-is for reprocessing old
// multi-print posts), this does NOT consolidate across images. It classifies
// each image independently as "feed" or "story" from its visual layout, and
// extracts that image's own metrics only. One API call covers the whole
// batch for cost efficiency, but the model is explicitly told never to mix
// data between images.
// ---------------------------------------------------------------------------
function buildBatchPrompt(imageCount) {
  return `Você é um sistema de classificação e extração de métricas de redes sociais.

Você recebeu ${imageCount} imagem${imageCount !== 1 ? 's' : ''} nesta mensagem. CADA imagem é um
post ou story DIFERENTE e INDEPENDENTE — não são prints do mesmo post. NUNCA misture ou
some dados entre imagens diferentes. Para cada imagem, faça duas coisas:

1) CLASSIFIQUE o formato pelo layout visual:
   - "story": tela costuma ter tira/miniaturas de stories no topo, cabeçalho
     "Overview"/"Visão geral", um gráfico circular ("donut"/anel) de
     Visualizações, e/ou um painel "Interações" com lista de métricas.
   - "feed": tela costuma ter cabeçalho "Post insights"/"Informações do post",
     a imagem única do post, ícones de curtida/comentário/compartilhar/salvar
     logo abaixo dela, e abas tipo "Overview/Engagement/Audience".
   Use o layout — não adivinhe pelo conteúdo da foto em si.

2) EXTRAIA as métricas APENAS dessa imagem (nunca de outra imagem da mensagem).

MAPEAMENTO OBRIGATÓRIO (terminologia atual do Instagram/Meta) — siga à risca:
- "reach" (Alcance) = o número rotulado "Contas alcançadas" quando existir.
  EM STORY: se a tela só mostra "Views"/"Visualizações" como número principal
  (ex: tela "Overview" do story com um círculo/anel e o rótulo "Views" no
  centro, SEM "Contas alcançadas" em lugar nenhum), esse "Views" do story
  conta como reach — é a métrica de alcance simplificada do story.
- "impressions" (Visualizações) = o número "Views"/"Visualizações" de um
  FEED post (ex: card "Summary" com Views/Viewers/Profile visits/Follows,
  tela "Post insights"). NUNCA preencha impressions em uma imagem já
  classificada como "story" — deixe sempre null nesse caso (o "Views" do
  story já foi usado como reach, acima).
- NUNCA troque "Visualizações"/"Views" de FEED por "Contas alcançadas": são
  métricas distintas nesse formato.
- "plays" = reproduções de vídeo/reel em FEED, quando rotulado explicitamente
  "Reproduções" (separado de "Visualizações"). Em story, deixe null.
- Em plataformas que ainda usam o rótulo "Impressões" (feed), trate como
  impressions.
- "profile_visits" (Visitas ao perfil) — sempre que aparecer, em qualquer
  formato. Variações: "Visitas ao perfil", "Perfil visitado", "Visualizações
  do perfil", "Toques no perfil", "Profile visits", "Profile activity".
- "likes" = ícone de coração / "Curtidas" / "Likes".
- "comments" = ícone de balão / "Comentários" / "Comments" / (em story,
  "Respostas"/"Replies" contam como comments).
- "shares" = ícone de reenvio/repost / "Compartilhamentos" / "Shares"/"Reposts".
- "saves" = ícone de marcador/bookmark / "Salvamentos" / "Saves" — SÓ existe em
  feed; em story deixe null.
- "link_clicks" = "Cliques no link"/"Toques no link"/"Link clicks".
- "engagement_rate" = taxa de engajamento em %, SÓ existe em feed; em story
  deixe null.

PAINEL "INTERAÇÕES" DO STORY (quando existir — círculo/donut com o total de
"Interações" no centro, seguido de uma lista de valores): leia CADA linha da
lista e mapeie Curtidas→likes, Respostas→comments, Compartilhamentos→shares,
Cliques no link→link_clicks, Visitas ao perfil→profile_visits. O número
central "Interações" (total) vai em extra.interacoes — NÃO confunda com
"Curtidas" (uma linha específica, quase sempre menor que o total).

Extraia TODAS as métricas visíveis que não se encaixem nos campos padrão (ex:
"Não-seguidores alcançados", "Viewers", "Follows", "Tempo médio de
visualização", "Seguidores %") no objeto "extra", com chaves em snake_case.
Converta percentuais para número decimal (4,5% → 4.5) e remova formatação de
milhar (12.157 → 12157). Só retorne null para uma métrica que realmente não
aparece naquela imagem.

Retorne SOMENTE um JSON válido, sem markdown, sem explicação, no formato:

{
  "results": [
    {
      "post_type": "feed" ou "story",
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
  ]
}

O array "results" DEVE ter exatamente ${imageCount} item${imageCount !== 1 ? 's' : ''},
na MESMA ORDEM das imagens recebidas (o item 1 corresponde ao Print 1, etc.).`;
}

/**
 * @param {Array<{buffer: Buffer, mimeType: string}>} images
 * @returns {Promise<Array<Object>>} One independent classification+extraction
 *   result per image, in the same order as `images`.
 */
async function classifyAndExtractBatch(images) {
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error('classifyAndExtractBatch requires at least one image');
  }

  const imageBlocks = images.flatMap(({ buffer, mimeType }, i) => [
    { type: 'text', text: `Print ${i + 1} de ${images.length} (post/story independente):` },
    {
      type: 'image',
      source: {
        type: 'base64',
        media_type: SUPPORTED_MIME_TYPES.includes(mimeType) ? mimeType : 'image/jpeg',
        data: buffer.toString('base64'),
      },
    },
  ]);

  const message = await client.messages.create(
    {
      model: MODEL,
      max_tokens: Math.min(1024 * images.length + 1024, 8192),
      messages: [
        {
          role: 'user',
          content: [...imageBlocks, { type: 'text', text: buildBatchPrompt(images.length) }],
        },
      ],
    },
    { timeout: AI_TIMEOUT_MS }
  );

  const parsed = parseAiJson(message.content[0].text);
  const results = Array.isArray(parsed?.results) ? parsed.results : [];

  if (results.length !== images.length) {
    throw new Error(
      `AI returned ${results.length} result(s) for ${images.length} image(s) — mismatched batch`
    );
  }

  return results;
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

module.exports = { extractMetrics, extractMetricsFromImages, classifyAndExtractBatch, pingModel };
