/* =========================================================
   FL Claims Guide: web server
   1. Serves the static site (HTML/CSS/JS/assets).
   2. POST /api/analyze: sends one photo to Claude and returns
      a structured description + value estimate.
   The Anthropic API key lives only here (read from .env).
   ========================================================= */

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import rateLimit from "express-rate-limit";
import Anthropic from "@anthropic-ai/sdk";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

const MODEL = "claude-opus-5-5";
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // Claude's per-image limit (decoded)

export const CATEGORIES = [
  "Jewelry & Watches",
  "Electronics",
  "Art & Collectibles",
  "Furniture",
  "Appliances",
  "Designer Clothing & Accessories",
  "Musical Instruments",
  "Sporting Goods & Tools",
  "Other",
];

// Claude must answer in exactly this shape (structured outputs).
const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    item_name: { type: "string", description: "Short name for the item, e.g. 'Stainless steel dive watch'" },
    category: { type: "string", enum: CATEGORIES },
    description: { type: "string", description: "1–3 sentences describing what is visible: brand, materials, condition, notable features" },
    estimated_value_low: { type: "integer", description: "Low end of estimated current resale/replacement value in whole US dollars" },
    estimated_value_high: { type: "integer", description: "High end of estimated value in whole US dollars" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    notes: { type: "string", description: "What the owner could provide to make the estimate more accurate (receipt, serial number, appraisal, close-up of a hallmark, etc.)" },
  },
  required: ["item_name", "category", "description", "estimated_value_low", "estimated_value_high", "confidence", "notes"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You help people build a home inventory of their belongings for insurance purposes.
You will be shown one photo of a household item. Identify the main item, place it in the best category, describe it, and estimate its current value in US dollars as a range.

Guidelines:
- Base the estimate on typical current replacement or resale prices for an item like this in the United States.
- Be honest about uncertainty. A photo can't confirm gold purity, gemstone quality, authenticity, or exact model. When those matter, widen the range, lower the confidence, and say in the notes what would narrow it down.
- If the photo shows several items, describe the most prominent one and mention the others in the notes.
- If no item can be identified (blurry photo, not a physical object), use item_name "Unidentified item", category "Other", a value range of 0 to 0, confidence "low", and explain in the notes how to take a better photo.
- Write in plain, friendly language. This is an estimate, not an appraisal.`;

/* ---------- Claude client ---------- */
// Reads ANTHROPIC_API_KEY from the environment (.env via `npm start`).
const anthropic = new Anthropic();

/**
 * Ask Claude to identify and value the item in one image.
 * Exported so it can be tested or reused.
 */
export async function analyzeImage({ mediaType, data }, client = anthropic) {
  if (client === anthropic && !process.env.ANTHROPIC_API_KEY) {
    console.error("Photo analysis requested but ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.");
    throw new UserFacingError(503, "AI analysis isn't set up on this server yet.");
  }

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    // If Claude's safety filters ever decline a request, retry on Anthropic's
    // recommended fallback model instead of failing.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: ANALYSIS_SCHEMA },
    },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data } },
          { type: "text", text: "Identify and estimate the value of this item for my home inventory." },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new UserFacingError(422, "This photo couldn't be analyzed. Try a different photo of the item.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new UserFacingError(502, "The analysis was cut off. Please try again.");
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock) throw new UserFacingError(502, "No analysis was returned. Please try again.");

  const result = JSON.parse(textBlock.text);
  // Keep the range in order even if the model swaps them.
  if (result.estimated_value_low > result.estimated_value_high) {
    [result.estimated_value_low, result.estimated_value_high] = [result.estimated_value_high, result.estimated_value_low];
  }
  return result;
}

class UserFacingError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/* ---------- Express app ---------- */
export function createApp({ analyze = analyzeImage } = {}) {
  const app = express();
  app.disable("x-powered-by");

  /* API */
  const analyzeLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 10, // per visitor per minute; each call costs money
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many photos analyzed at once. Please wait a minute and try again." },
  });

  app.post("/api/analyze", analyzeLimiter, express.json({ limit: "8mb" }), async (req, res) => {
    const { mediaType, data } = req.body ?? {};

    if (!ALLOWED_IMAGE_TYPES.includes(mediaType) || typeof data !== "string" || data.length === 0) {
      return res.status(400).json({ error: "Please send a JPG, PNG, WebP, or GIF image." });
    }
    if (Buffer.byteLength(data, "base64") > MAX_IMAGE_BYTES) {
      return res.status(413).json({ error: "That image is too large to analyze. Try a smaller photo." });
    }

    try {
      const result = await analyze({ mediaType, data });
      res.json(result);
    } catch (err) {
      const { status, message } = toClientError(err);
      res.status(status).json({ error: message });
    }
  });

  // Malformed or oversized JSON bodies.
  app.use("/api", (err, req, res, next) => {
    if (err.type === "entity.too.large") {
      return res.status(413).json({ error: "That image is too large to analyze. Try a smaller photo." });
    }
    if (err.type === "entity.parse.failed") {
      return res.status(400).json({ error: "Invalid request." });
    }
    next(err);
  });

  app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));

  /* Static site: only the public folders and top-level .html pages.
     Never serve the project root, which holds .env, server.js and node_modules. */
  for (const dir of ["css", "js", "assets"]) {
    app.use(`/${dir}`, express.static(path.join(ROOT, dir), { index: false }));
  }
  app.get("/", (req, res) => res.sendFile(path.join(ROOT, "index.html")));
  app.use((req, res, next) => {
    const match = /^\/([a-z0-9-]+\.html)$/.exec(req.path);
    if (req.method === "GET" && match && fs.existsSync(path.join(ROOT, match[1]))) {
      return res.sendFile(path.join(ROOT, match[1]));
    }
    next();
  });
  app.use((req, res) => res.status(404).send("Page not found"));

  return app;
}

/** Map any error to a safe status + message. Never leak internal details. */
function toClientError(err) {
  if (err instanceof UserFacingError) return { status: err.status, message: err.message };

  if (err instanceof Anthropic.AuthenticationError) {
    console.error("Anthropic authentication failed. Check ANTHROPIC_API_KEY in .env.");
    return { status: 503, message: "The AI service isn't set up correctly. Please try again later." };
  }
  if (err instanceof Anthropic.RateLimitError) {
    return { status: 429, message: "The AI service is busy. Please try again in a minute." };
  }
  if (err instanceof Anthropic.BadRequestError) {
    console.error("Anthropic rejected the request:", err.message);
    return { status: 422, message: "This photo couldn't be analyzed. Try a JPG or PNG photo." };
  }
  if (err instanceof Anthropic.APIError) {
    console.error(`Anthropic API error ${err.status}:`, err.message);
    return { status: 502, message: "The AI service had a problem. Please try again." };
  }

  console.error("Unexpected error in /api/analyze:", err);
  return { status: 500, message: "Something went wrong. Please try again." };
}

/* ---------- Start (only when run directly, not when imported by tests) ---------- */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("⚠  ANTHROPIC_API_KEY is not set. The site will work, but photo analysis will fail.");
    console.warn("   Copy .env.example to .env and add your key.");
  }
  createApp().listen(PORT, () => {
    console.log(`FL Claims Guide running at http://localhost:${PORT}`);
  });
}
