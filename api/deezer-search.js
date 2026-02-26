// api/deezer-search.js
export default async function handler(req, res) {
  const origin = req.headers.origin;

  const allowedOrigins = [
    "http://localhost:3000",
    "https://teric-simons.github.io",
  ];

  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const q = (req.query.q || "").toString().trim();
  if (!q) return res.status(400).json({ error: "Missing q parameter" });

  const url = `https://api.deezer.com/search?q=${encodeURIComponent(q)}`;
  const r = await fetch(url);
  const data = await r.json();

  return res.status(200).json(data);
}
