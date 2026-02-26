export default async function handler(req, res) {
  // Allow your GitHub Pages domain
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://teric-simons.github.io"
  );
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const q = (req.query.q || "").toString().trim();
  if (!q) {
    return res.status(400).json({ error: "Missing q parameter" });
  }

  try {
    const url = `https://api.deezer.com/search?q=${encodeURIComponent(q)}`;
    const response = await fetch(url);
    const data = await response.json();

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: "Deezer fetch failed" });
  }
}
