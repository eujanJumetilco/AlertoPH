import { GoogleGenerativeAI } from "@google/generative-ai";

const genAi = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

const prompt = `You are an evidence image analyst for a public complaint reporting system. Your sole job is to produce a structured, factual description of the provided image(s) that will be used by a downstream report classifier.

Analyze the image(s) and describe only what is objectively visible. Your description must be optimized to help classify the incident into one of these report types: Crime, Red Tape, Scam, Child Abuse, Women Abuse, Overpricing, Fire, Accident, or Gas Station Concerns.

Focus on:
- The scene or environment (e.g., street, store interior, government office, gas station, vehicle)
- Any visible people — their apparent condition, posture, or actions (do NOT name or identify individuals)
- Any visible text, signage, price tags, receipts, labels, or documents
- Physical evidence of harm, damage, hazard, or wrongdoing (e.g., injuries, fire, collision damage, suspicious materials)
- Any objects relevant to the incident (e.g., weapons, gas pumps, official seals, receipts)
- Timestamps, watermarks, or metadata visible in the image

Output rules:
1. Write in plain, factual, third-person prose. No bullet points.
2. If multiple images are provided, describe them in sequence: "Image 1 shows... Image 2 shows..."
3. Do NOT speculate beyond what is visible. Do NOT assign blame or draw legal conclusions.
4. Do NOT include conversational filler, greetings, or commentary.
5. Keep the total description under 200 words.
6. If the image is blurry, dark, or unintelligible, state: "Image could not be analyzed due to poor quality."

Produce only the description text — nothing else.`;

const MODEL_FALLBACKS = [
  "gemini-2.5-flash",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-2.5-flash-image",
];

/**
 * Formats a raw base64 string (with or without a Data URI header)
 * into Gemini's inlineData payload.
 *
 * @param {string} base64 - A plain base64 string or a Data URI (data:image/...;base64,...)
 * @returns {{ inlineData: { data: string, mimeType: string } }}
 */
function formatImageForGemini(base64) {
  if (base64.startsWith("data:")) {
    const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      return {
        inlineData: {
          mimeType: matches[1],
          data: matches[2],
        },
      };
    }
  }

  return {
    inlineData: {
      mimeType: "image/jpeg",
      data: base64,
    },
  };
}

/**
 * Tries to analyze images with a single model. Throws if it fails.
 *
 * @param {string} modelName
 * @param {Array} imageParts
 * @returns {Promise<string>}
 */
async function tryWithModel(modelName, imageParts) {
  const model = genAi.getGenerativeModel({ model: modelName });
  const result = await model.generateContent([prompt, ...imageParts]);
  return result.response.text();
}

/**
 * Analyzes an array of base64 image strings, falling back through
 * multiple models before giving up and returning "Not provided".
 *
 * @param {string[]} base64Images - Array of base64 strings (plain or Data URI format)
 * @returns {Promise<string>}
 */
export async function analyzeImages(base64Images) {
  const items = Array.isArray(base64Images) ? base64Images : [base64Images];
  const imageParts = items.map(formatImageForGemini);

  for (const modelName of MODEL_FALLBACKS) {
    try {
      console.log(`Trying image reading model: ${modelName}`);
      const text = await tryWithModel(modelName, imageParts);
      console.log(`Success with image reading model: ${modelName}`);
      return text;
    } catch (error) {
      console.warn(`Model ${modelName} failed:`, error?.message ?? error);
    }
  }

  console.error("All models failed. Returning fallback value.");
  return "Not provided";
}