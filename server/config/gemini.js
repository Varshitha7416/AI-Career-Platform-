const { GoogleGenerativeAI } = require('@google/generative-ai');

let client;

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

// Returns generated text, throwing an error with .status set for API-level failures.
const generateText = async (prompt) => {
  if (!process.env.GEMINI_API_KEY) {
    const err = new Error('AI service is not configured');
    err.status = 503;
    throw err;
  }
  try {
    client = client || new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = client.getGenerativeModel({ model: MODEL });
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Gemini error:', error.message);
    const err = new Error('The AI service is temporarily unavailable. Please try again.');
    err.status = 502;
    throw err;
  }
};

module.exports = { generateText };
