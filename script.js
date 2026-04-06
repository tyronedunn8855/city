/* ═══════════════════════════════════════════
HIDDEN GEMS — script.js
Handles: vibe buttons, API key, AI fetch,
card rendering, state management
═══════════════════════════════════════════ */

// ── Config ─────────────────────────────────────────
const VIBES = [
{ label: “Chill”,       emoji: “🌿” },
{ label: “Adventurous”, emoji: “🗺️” },
{ label: “Budget”,      emoji: “💸” },
{ label: “Fancy”,       emoji: “✨” },
{ label: “Local”,       emoji: “🏘️” },
{ label: “Romantic”,    emoji: “🌹” },
];

const CAT_META = {
Food:      { emoji: “🍽️”, color: “#8B1A1A” },
Explore:   { emoji: “🧭”, color: “#1A3A4A” },
Nightlife: { emoji: “🌙”, color: “#2A1A4A” },
Nature:    { emoji: “🌲”, color: “#1A3A1A” },
Culture:   { emoji: “🎨”, color: “#4A2A1A” },
Shop:      { emoji: “🛍️”, color: “#3A1A3A” },
};

// ── State ───────────────────────────────────────────
let selectedVibe = “Chill”;
let apiKey = localStorage.getItem(“hg_api_key”) || “”;

// ── DOM Refs ────────────────────────────────────────
const cityInput   = document.getElementById(“cityInput”);
const exploreBtn  = document.getElementById(“exploreBtn”);
const vibesRow    = document.getElementById(“vibesRow”);
const apiKeyInput = document.getElementById(“apiKeyInput”);
const apiSaveBtn  = document.getElementById(“apiSaveBtn”);
const apiHint     = document.getElementById(“apiHint”);
const stateArea   = document.getElementById(“stateArea”);
const resultsArea = document.getElementById(“resultsArea”);
const cardsGrid   = document.getElementById(“cardsGrid”);
const cityLabel   = document.getElementById(“cityLabel”);
const vibeLabel   = document.getElementById(“vibeLabel”);
const stateIcon   = document.getElementById(“stateIcon”);
const stateTitle  = document.getElementById(“stateTitle”);
const stateSub    = document.getElementById(“stateSub”);

// ── Init ─────────────────────────────────────────────
function init() {
buildVibeButtons();
restoreApiKey();

exploreBtn.addEventListener(“click”, handleExplore);
apiSaveBtn.addEventListener(“click”, saveApiKey);

// Allow Enter key in city input
cityInput.addEventListener(“keydown”, (e) => {
if (e.key === “Enter”) handleExplore();
});

// Allow Enter key in API key input
apiKeyInput.addEventListener(“keydown”, (e) => {
if (e.key === “Enter”) saveApiKey();
});
}

// ── Build vibe buttons ────────────────────────────────
function buildVibeButtons() {
VIBES.forEach(({ label, emoji }) => {
const btn = document.createElement(“button”);
btn.className = “vibe-btn” + (label === selectedVibe ? “ active” : “”);
btn.textContent = `${emoji} ${label}`;
btn.addEventListener(“click”, () => selectVibe(label));
vibesRow.appendChild(btn);
});
}

function selectVibe(label) {
selectedVibe = label;
document.querySelectorAll(”.vibe-btn”).forEach((btn) => {
btn.classList.toggle(“active”, btn.textContent.includes(label));
});
}

// ── API Key ───────────────────────────────────────────
function saveApiKey() {
const val = apiKeyInput.value.trim();
if (!val) return;
apiKey = val;
localStorage.setItem(“hg_api_key”, val);
apiKeyInput.value = “”;
apiHint.textContent = “✅ API key saved! Now type a city and explore.”;
apiHint.classList.add(“saved”);
}

function restoreApiKey() {
if (apiKey) {
apiHint.textContent = “✅ API key loaded. Ready to explore!”;
apiHint.classList.add(“saved”);
}
}

// ── Handle Explore click ───────────────────────────────
async function handleExplore() {
const city = cityInput.value.trim();

if (!apiKey) {
showState(“🔑”, “API key required”, “Paste your Anthropic API key above and click Save Key.”);
return;
}

if (!city) {
showState(“✏️”, “Enter a city first”, “Type any city name in the search bar above.”);
return;
}

await fetchGems(city);
}

// ── Fetch from Anthropic API ───────────────────────────
async function fetchGems(city) {
// Show loading state
showState(“🧭”, `Exploring ${city}…`, “Consulting the local archives for hidden gems.”, true);
resultsArea.classList.add(“hidden”);
exploreBtn.disabled = true;
exploreBtn.textContent = “Searching…”;

const prompt = `You are a seasoned local travel expert. List exactly 6 hidden gem spots in ${city} for a “${selectedVibe}” vibe traveler. Include real, specific, lesser-known places — NOT tourist traps or generic suggestions.

Return ONLY a valid JSON array. No markdown, no backticks, no explanation. Start with [ and end with ].

Use this exact schema:
[
{
“name”: “Place Name”,
“category”: “Food”,
“description”: “Two vivid, evocative sentences about what makes this place special.”,
“tip”: “One genuine insider secret that only locals would know.”,
“priceRange”: “$$”,
“mustTry”: “The single best thing to order, see, or do here.”
}
]

Category must be exactly one of: Food, Explore, Nightlife, Nature, Culture, Shop
priceRange must be exactly one of: $, $$, $$$, $$$$`;

try {
const res = await fetch(“https://api.anthropic.com/v1/messages”, {
method: “POST”,
headers: {
“Content-Type”: “application/json”,
“x-api-key”: apiKey,
“anthropic-version”: “2023-06-01”,
“anthropic-dangerous-direct-browser-access”: “true”,
},
body: JSON.stringify({
model: “claude-opus-4-5”,
max_tokens: 1400,
messages: [{ role: “user”, content: prompt }],
}),
});

```
if (!res.ok) {
  const err = await res.json();
  throw new Error(err.error?.message || `API error ${res.status}`);
}

const data = await res.json();
const raw  = data.content[0].text.replace(/```json|```/g, "").trim();
const spots = JSON.parse(raw);

renderCards(spots, city);
```

} catch (err) {
console.error(err);
showState(
“⚠️”,
“Something went wrong”,
err.message.includes(“401”)
? “Invalid API key — double-check it and save again.”
: “Could not load results. Try again or check the city name.”
);
}

exploreBtn.disabled = false;
exploreBtn.textContent = “Explore →”;
}

// ── Render cards ────────────────────────────────────────
function renderCards(spots, city) {
// Clear old cards
cardsGrid.innerHTML = “”;

// Update section header
cityLabel.textContent = city;
vibeLabel.textContent = `${selectedVibe} Vibe · ${spots.length} Hidden Gems`;

// Build each card
spots.forEach((spot) => {
const meta = CAT_META[spot.category] || { emoji: “📍”, color: “#1A2744” };
const card = document.createElement(“article”);
card.className = “card”;

```
card.innerHTML = `
  <div class="card-stamp" style="background: ${meta.color};">
    <span>${meta.emoji}</span>
    <span>${spot.category}</span>
  </div>
  <div class="card-body">
    <div class="card-name">${escapeHtml(spot.name)}</div>
    <div class="card-meta">${escapeHtml(spot.priceRange)} · ${escapeHtml(spot.category)}</div>
    <p class="card-desc">${escapeHtml(spot.description)}</p>
    <div class="card-divider"></div>
    <div class="card-info">
      <div class="card-info-label">📍 Must Try</div>
      <div class="card-info-text">${escapeHtml(spot.mustTry)}</div>
    </div>
    <div class="card-info">
      <div class="card-info-label">🤫 Insider Tip</div>
      <div class="card-info-text">${escapeHtml(spot.tip)}</div>
    </div>
  </div>
`;

cardsGrid.appendChild(card);
```

});

// Hide state, show results
stateArea.classList.add(“hidden”);
resultsArea.classList.remove(“hidden”);
}

// ── State helper ────────────────────────────────────────
function showState(icon, title, sub, spinning = false) {
stateIcon.textContent = icon;
stateIcon.className   = “state-icon” + (spinning ? “ spinning” : “”);
stateTitle.textContent = title;
stateSub.textContent   = sub;

stateArea.classList.remove(“hidden”);
resultsArea.classList.add(“hidden”);
}

// ── Safety: escape HTML to prevent XSS ──────────────────
function escapeHtml(str) {
const div = document.createElement(“div”);
div.textContent = str;
return div.innerHTML;
}

// ── Run ──────────────────────────────────────────────────
init();
