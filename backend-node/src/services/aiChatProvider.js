/**
 * AI chat completion — Ollama (dev), Anthropic Claude (prod), or Gemini (legacy).
 */
const { logger } = require('../lib/logger');

function resolveProvider() {
  const explicit = (process.env.AI_PROVIDER || '').toLowerCase();
  if (explicit === 'ollama') return 'ollama';
  if (explicit === 'anthropic' && process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (explicit === 'gemini' && process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (explicit === 'ollama' || process.env.OLLAMA_BASE_URL) return 'ollama';
  return null;
}

function toAssistantRole(role) {
  return role === 'model' ? 'assistant' : 'user';
}

let geminiClient;
function getGemini() {
  if (geminiClient) return geminiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const { GoogleGenAI } = require('@google/genai');
  geminiClient = new GoogleGenAI({ apiKey });
  return geminiClient;
}

async function completeWithGemini({ system, messages }) {
  const ai = getGemini();
  if (!ai) throw new Error('GEMINI_API_KEY is not configured');
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const contents = messages.map((m) => ({
    role: m.role,
    parts: [{ text: m.content }],
  }));
  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction: system,
      temperature: Number(process.env.AI_TEMPERATURE || 0.7),
    },
  });
  return response?.text || '';
}

async function completeWithOllama({ system, messages }) {
  const base = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
  const model = process.env.OLLAMA_MODEL || 'llama3.2';
  const ollamaMessages = [
    { role: 'system', content: system },
    ...messages.map((m) => ({ role: toAssistantRole(m.role), content: m.content })),
  ];
  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: ollamaMessages,
      stream: false,
      options: {
        temperature: Number(process.env.OLLAMA_TEMPERATURE ?? 0.35),
        num_predict: Number(process.env.OLLAMA_NUM_PREDICT || 800),
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ollama ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.message?.content || '';
}

async function completeWithAnthropic({ system, messages }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: Number(process.env.AI_MAX_TOKENS || 1024),
      temperature: Number(process.env.AI_TEMPERATURE || 0.7),
      system,
      messages: messages.map((m) => ({
        role: toAssistantRole(m.role),
        content: m.content,
      })),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Anthropic ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const block = data.content?.find((b) => b.type === 'text');
  return block?.text || '';
}

/**
 * @param {{ system: string, messages: Array<{ role: 'user'|'model', content: string }> }} opts
 */
async function completeChat(opts) {
  const provider = resolveProvider();
  if (!provider) {
    throw new Error(
      'AI is not configured. Set ANTHROPIC_API_KEY, GEMINI_API_KEY, or AI_PROVIDER=ollama with Ollama running.'
    );
  }
  logger.debug({ provider }, 'AI chat provider');
  if (provider === 'anthropic') return completeWithAnthropic(opts);
  if (provider === 'ollama') return completeWithOllama(opts);
  return completeWithGemini(opts);
}

function providerConfigHint() {
  const p = resolveProvider();
  if (p === 'anthropic') return 'ANTHROPIC_API_KEY';
  if (p === 'gemini') return 'GEMINI_API_KEY';
  if (p === 'ollama') return 'Ollama (AI_PROVIDER=ollama)';
  return 'ANTHROPIC_API_KEY, GEMINI_API_KEY, or Ollama';
}

module.exports = { completeChat, resolveProvider, providerConfigHint };
