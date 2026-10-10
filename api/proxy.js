// api/proxy.js
// Vercel serverless function. API keys NEVER reach the browser:
// they are read from Environment Variables set in the Vercel dashboard
// (ANTHROPIC_API_KEY, PEXELS_API_KEY).
//
// The proxy only forwards the two requests the Hidden Gems page makes:
//   { service: "anthropic", payload: { model, max_tokens, messages:[{role:"user", content}] } }
//   { service: "pexels", query }
// Anything else is rejected, so the keys cannot be used as a general-purpose API.

// Models the page is allowed to use. Add a model here if index.html changes.
const ALLOWED_MODELS = new Set(["claude-haiku-4-5-20251001"]);
const MAX_TOKENS_CAP = 2200;          // what the page requests
const MAX_PROMPT_CHARS = 4000;        // page prompt is ~1,500 chars plus the city name
const PROMPT_PREFIX = "You are an expert local travel guide."; // the page's prompt starts with this
const MAX_QUERY_CHARS = 120;          // Pexels search phrase + city
const MAX_BODY_BYTES = 16 * 1024;

// Optional: comma-separated list of extra allowed origins, e.g. a custom domain.
// Same-host requests (the deployed site itself, including preview URLs) are always allowed.
const EXTRA_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",").map((s) => s.trim()).filter(Boolean);

// Best-effort per-IP rate limit. It lives in memory, so it resets when Vercel
// starts a new instance; it slows casual abuse but is not a hard quota.
// Set a monthly spend limit in the Anthropic console as the real backstop.
const LIMITS = { anthropic: 12, pexels: 80 }; // requests per minute per IP
const hits = new Map();
function rateLimited(ip, service) {
  const now = Date.now();
  const key = service + ":" + ip;
  const recent = (hits.get(key) || []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > LIMITS[service];
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // same-origin GET/POST from some browsers, or server tools
  try {
    const o = new URL(origin);
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    if (o.host === host) return true;
    return EXTRA_ORIGINS.includes(o.origin);
  } catch {
    return false;
  }
}

function readBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    if (body.length > MAX_BODY_BYTES) return null;
    try { body = JSON.parse(body); } catch { return null; }
  }
  return body && typeof body === "object" ? body : null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!sameOrigin(req)) {
    return res.status(403).json({ error: "Origin not allowed" });
  }

  const len = parseInt(req.headers["content-length"] || "0", 10);
  if (len > MAX_BODY_BYTES) {
    return res.status(413).json({ error: "Request too large" });
  }

  const body = readBody(req);
  if (!body) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const { service } = body;
  if (service !== "anthropic" && service !== "pexels") {
    return res.status(400).json({ error: "Unknown service. Use 'anthropic' or 'pexels'." });
  }

  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  if (rateLimited(ip, service)) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: { message: "Too many requests. Wait a minute and try again." } });
  }

  // ── ANTHROPIC ──────────────────────────────────────────────
  if (service === "anthropic") {
    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_KEY) {
      return res.status(500).json({ error: "Anthropic key not set in Vercel environment variables" });
    }

    const p = body.payload || {};
    const msgs = p.messages;
    const content = Array.isArray(msgs) && msgs.length === 1 && msgs[0] && msgs[0].role === "user" ? msgs[0].content : null;
    if (
      !ALLOWED_MODELS.has(p.model) ||
      typeof content !== "string" ||
      content.length > MAX_PROMPT_CHARS ||
      !content.startsWith(PROMPT_PREFIX)
    ) {
      return res.status(400).json({ error: { message: "Request not allowed by proxy" } });
    }

    // Rebuild the payload from known fields only (no system prompt, tools, etc.)
    const safePayload = {
      model: p.model,
      max_tokens: Math.min(Math.max(parseInt(p.max_tokens, 10) || MAX_TOKENS_CAP, 1), MAX_TOKENS_CAP),
      messages: [{ role: "user", content }],
    };

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(safePayload),
      });

      const data = await response.json();
      return res.status(response.status).json(data);
    } catch (err) {
      return res.status(502).json({ error: "Anthropic request failed" });
    }
  }

  // ── PEXELS ────────────────────────────────────────────────
  const PEXELS_KEY = process.env.PEXELS_API_KEY;
  if (!PEXELS_KEY) {
    return res.status(500).json({ error: "Pexels key not set in Vercel environment variables" });
  }

  const rawQuery = typeof body.query === "string" ? body.query.trim() : "";
  const query = encodeURIComponent((rawQuery || "travel city").slice(0, MAX_QUERY_CHARS));

  try {
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${query}&per_page=5&orientation=landscape`,
      { headers: { Authorization: PEXELS_KEY } }
    );
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: "Pexels request failed" });
  }
}
