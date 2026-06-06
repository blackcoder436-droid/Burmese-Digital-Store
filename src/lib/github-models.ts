const DEFAULT_GITHUB_MODELS_API_URL = 'https://models.github.ai/inference';
const DEFAULT_GITHUB_MODELS_CATALOG_URL = 'https://models.github.ai/catalog/models';
const DEFAULT_GITHUB_MODELS_API_VERSION = '2026-03-10';
const DEFAULT_REQUEST_TIMEOUT_MS = 60000;

export interface GitHubModelsMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GitHubModelsChatOptions {
  token: string;
  model: string;
  messages: GitHubModelsMessage[];
  apiUrl?: string;
  apiVersion?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  timeoutMs?: number;
}

export interface GitHubModelOption {
  id: string;
  label: string;
  registry?: string;
  rateLimitTier?: string;
}

interface CatalogModel {
  id?: unknown;
  name?: unknown;
  registry?: unknown;
  rate_limit_tier?: unknown;
}

interface ChatResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
  message?: string;
}

export function getGitHubModelsRequestTimeout(): number {
  const parsed = Number(process.env.GITHUB_MODELS_REQUEST_TIMEOUT || DEFAULT_REQUEST_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_REQUEST_TIMEOUT_MS;
}

export function resolveGitHubModelsApiVersion(): string {
  return process.env.GITHUB_MODELS_API_VERSION || DEFAULT_GITHUB_MODELS_API_VERSION;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function getChatCompletionsUrl(apiUrl?: string): string {
  const base = trimTrailingSlash(apiUrl || DEFAULT_GITHUB_MODELS_API_URL);
  if (base.endsWith('/chat/completions')) return base;
  return `${base}/chat/completions`;
}

function isGitHubModelsUrl(url: string): boolean {
  return url.includes('models.github.ai');
}

function shouldUseCompletionTokens(model: string): boolean {
  const normalized = model.toLowerCase();
  const modelName = normalized.includes('/') ? normalized.split('/').pop() || normalized : normalized;
  return modelName.startsWith('gpt-5') || /^o\d/.test(modelName) || modelName.startsWith('o-');
}

function buildHeaders(token: string, url: string, apiVersion?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  if (isGitHubModelsUrl(url)) {
    headers.Accept = 'application/vnd.github+json';
    headers['X-GitHub-Api-Version'] = apiVersion || resolveGitHubModelsApiVersion();
  }

  return headers;
}

function buildChatBody(
  options: GitHubModelsChatOptions,
  useCompletionTokens: boolean,
  includeTemperature: boolean
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: options.model,
    messages: options.messages,
    stream: options.stream === true,
  };

  if (useCompletionTokens) {
    body.max_completion_tokens = options.maxTokens ?? 1024;
  } else {
    body.max_tokens = options.maxTokens ?? 1024;
  }

  if (includeTemperature) {
    body.temperature = options.temperature ?? 0.7;
  }

  return body;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text().catch(() => '');
  if (!text) return response.statusText || 'Unknown error';

  try {
    const parsed = JSON.parse(text) as ChatResponse;
    return parsed.error?.message || parsed.message || text;
  } catch {
    return text;
  }
}

function shouldRetryWithDifferentTokenField(message: string): boolean {
  return /max_tokens/i.test(message) && /max_completion_tokens/i.test(message);
}

function shouldRetryWithoutTemperature(message: string, includeTemperature: boolean): boolean {
  return includeTemperature && /temperature/i.test(message);
}

async function postChatCompletion(
  options: GitHubModelsChatOptions,
  useCompletionTokens: boolean,
  includeTemperature: boolean
): Promise<Response> {
  const url = getChatCompletionsUrl(options.apiUrl);
  return fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: buildHeaders(options.token, url, options.apiVersion),
      body: JSON.stringify(buildChatBody(options, useCompletionTokens, includeTemperature)),
    },
    options.timeoutMs ?? getGitHubModelsRequestTimeout()
  );
}

export async function requestGitHubModelsChatCompletion(
  options: GitHubModelsChatOptions
): Promise<Response> {
  const url = getChatCompletionsUrl(options.apiUrl);
  let useCompletionTokens = isGitHubModelsUrl(url) && shouldUseCompletionTokens(options.model);
  let includeTemperature = !useCompletionTokens;
  let response = await postChatCompletion(options, useCompletionTokens, includeTemperature);

  if (response.ok) return response;

  let errorMessage = await readErrorMessage(response);
  const retryTokenField = shouldRetryWithDifferentTokenField(errorMessage);
  const retryTemperature = shouldRetryWithoutTemperature(errorMessage, includeTemperature);

  if (retryTokenField || retryTemperature) {
    useCompletionTokens = retryTokenField ? !useCompletionTokens : useCompletionTokens;
    includeTemperature = false;
    response = await postChatCompletion(options, useCompletionTokens, includeTemperature);
    if (response.ok) return response;
    errorMessage = await readErrorMessage(response);
  }

  throw new Error(`AI API error (${response.status}): ${errorMessage}`);
}

export function getChatCompletionText(response: ChatResponse): string {
  const content = response.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) return content.map((part) => part.text || '').join('').trim();
  return '';
}

export async function runGitHubModelsTextCompletion(
  options: GitHubModelsChatOptions
): Promise<string> {
  const response = await requestGitHubModelsChatCompletion({
    ...options,
    stream: false,
  });
  const json = (await response.json()) as ChatResponse;
  const output = getChatCompletionText(json);
  if (!output) throw new Error('The model returned an empty response.');
  return output;
}

export function getStreamingDeltaText(parsed: unknown): string {
  if (!parsed || typeof parsed !== 'object') return '';
  const choice = (parsed as { choices?: Array<{ delta?: { content?: unknown } }> }).choices?.[0];
  const content = choice?.delta?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (part && typeof part === 'object' && 'text' in part ? String(part.text || '') : ''))
      .join('');
  }
  return '';
}

function normalizeCatalogModels(rawModels: unknown): GitHubModelOption[] {
  if (!Array.isArray(rawModels)) return [];

  return (rawModels as CatalogModel[])
    .map<GitHubModelOption | null>((rawModel) => {
      if (typeof rawModel.id !== 'string' || !rawModel.id.trim()) return null;
      const id = rawModel.id.trim();
      const label = typeof rawModel.name === 'string' && rawModel.name.trim() ? rawModel.name.trim() : id;
      const registry =
        typeof rawModel.registry === 'string' && rawModel.registry.trim()
          ? rawModel.registry.trim()
          : undefined;
      const rateLimitTier =
        typeof rawModel.rate_limit_tier === 'string' && rawModel.rate_limit_tier.trim()
          ? rawModel.rate_limit_tier.trim()
          : undefined;

      return { id, label, registry, rateLimitTier };
    })
    .filter((model): model is GitHubModelOption => Boolean(model))
    .filter((model) => {
      const id = model.id.toLowerCase();
      return model.rateLimitTier !== 'embeddings' && !id.includes('embedding');
    });
}

export async function loadGitHubModelsCatalog(
  token: string,
  options: {
    catalogUrl?: string;
    apiVersion?: string;
    timeoutMs?: number;
  } = {}
): Promise<GitHubModelOption[]> {
  const url = options.catalogUrl || DEFAULT_GITHUB_MODELS_CATALOG_URL;
  const response = await fetchWithTimeout(
    url,
    {
      headers: buildHeaders(token, url, options.apiVersion),
    },
    options.timeoutMs ?? getGitHubModelsRequestTimeout()
  );

  if (!response.ok) {
    const errorMessage = await readErrorMessage(response);
    throw new Error(`GitHub Models catalog error (${response.status}): ${errorMessage}`);
  }

  return normalizeCatalogModels(await response.json());
}
