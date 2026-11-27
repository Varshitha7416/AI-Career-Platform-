// Facade (docs/32). Every AI caller still imports this file and calls generateJSON / generateText exactly as before.
// The calls now go through the provider manager (Gemini primary, optional Groq fallback); the Gemini transport, retry and
// JSON logic live unchanged in services/ai/providers/geminiProvider.js. The test hooks are forwarded to that provider.
const provider = require('../services/ai/providers/geminiProvider');
const { defaultManager } = require('../services/ai/manager');

module.exports = {
  generateText: (prompt, opts) => defaultManager.generateText(prompt, opts),
  generateJSON: (prompt, opts) => defaultManager.generateJSON(prompt, opts),
  parseJsonLoose: provider.parseJsonLoose,
  stripFences: provider.stripFences,
  aiError: provider.aiError,
  MAX_PROMPT_CHARS: provider.MAX_PROMPT_CHARS,
  QUOTA_MESSAGE: provider.QUOTA_MESSAGE,
  _setRawGenerate: provider._setRawGenerate,
  _setSleep: provider._setSleep,
  _fixtureActive: provider._fixtureActive,
  _manager: defaultManager,
};
