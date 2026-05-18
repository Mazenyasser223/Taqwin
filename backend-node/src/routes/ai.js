/**
 * AI proxy — server-side Gemini call so the API key never reaches the browser.
 *
 *   POST /api/ai/chat
 *     body: { messages: [{ role: 'user'|'model', content: string }, ...] }
 *
 *   Returns: { reply: string }
 */
const express = require('express');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { logger } = require('../lib/logger');

const router = express.Router();
router.use(authMiddleware);

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.AI_RATE_LIMIT_MAX || 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI request rate limit exceeded. Slow down.' },
});

const chatSchema = z.object({
  body: z.object({
    messages: z
      .array(
        z.object({
          role: z.enum(['user', 'model']),
          content: z.string().min(1).max(4000),
        })
      )
      .min(1)
      .max(40),
    system: z.string().max(2000).optional(),
  }),
});

const SYSTEM_PROMPT =
  "You are Taqwin's in-app fitness coach. Reply in concise, motivating language. " +
  'Tailor advice to athletes, trainers, and gym owners. Recommend safe, evidence-based practices. ' +
  'Suggest the user consult a medical professional for medical concerns.';

let geminiClient;
function getGemini() {
  if (geminiClient) return geminiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const { GoogleGenAI } = require('@google/genai');
  geminiClient = new GoogleGenAI({ apiKey });
  return geminiClient;
}

router.post('/chat', aiLimiter, validate(chatSchema), async (req, res) => {
  try {
    const ai = getGemini();
    if (!ai) {
      return res.status(503).json({ error: 'AI is not configured. Set GEMINI_API_KEY.' });
    }
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    const contents = req.body.messages.map((m) => ({
      role: m.role,
      parts: [{ text: m.content }],
    }));

    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: req.body.system || SYSTEM_PROMPT,
        temperature: 0.7,
      },
    });
    const reply = response?.text || '';
    res.json({ reply });
  } catch (err) {
    logger.error({ err }, 'Gemini call failed');
    res.status(502).json({ error: 'AI request failed' });
  }
});

module.exports = router;
