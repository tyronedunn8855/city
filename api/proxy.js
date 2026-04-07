// api/proxy.js
// Vercel serverless function — your API keys NEVER reach the browser.
// Keys are stored as Environment Variables in your Vercel dashboard.

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { service } = req.body;

  // ── ANTHROPIC ──────────────────────────────────────────────
  if (service === "anthropic") {
    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_KEY) {
      return res.status(500).json({ error: "Anthropic key not set in Vercel environment variables" });
    }

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(req.body.payload),
      });

      const data = await response.json();
      return res.status(response.status).json(data);
    } catch (err) {
      return res.status(502).json({ error: "Anthropic request failed: " + err.message });
    }
  }

  // ── PEXELS ────────────────────────────────────────────────
  if (service === "pexels") {
    const PEXELS_KEY = process.env.PEXELS_API_KEY;
    if (!PEXELS_KEY) {
      return res.status(500).json({ error: "Pexels key not set in Vercel environment variables" });
    }

    try {
      const query = encodeURIComponent(req.body.query || "travel city");
      const response = await fetch(
        `https://api.pexels.com/v1/search?query=${query}&per_page=5&orientation=landscape`,
        { headers: { Authorization: PEXELS_KEY } }
      );
      const data = await response.json();
      return res.status(response.status).json(data);
    } catch (err) {
      return res.status(502).json({ error: "Pexels request failed: " + err.message });
    }
  }

  return res.status(400).json({ error: "Unknown service. Use 'anthropic' or 'pexels'." });
}
