
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });

  try {
    // Pull recent rows (simple + reliable). We aggregate in JS.
    const { data, error } = await supabase
      .from("song_choices")
      .select("track_id,title,artist,album,cover_url,preview_url,created_at")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) return res.status(500).json({ error: error.message });

    const map = new Map();
    for (const r of data || []) {
      const key = String(r.track_id);
      if (!map.has(key)) {
        map.set(key, {
          id: r.track_id,
          title: r.title,
          artist: r.artist,
          album: r.album,
          cover: r.cover_url,
          preview: r.preview_url,
          votes: 0,
          lastChosenAt: r.created_at,
        });
      }
      const item = map.get(key);
      item.votes += 1;

      // keep newest timestamp
      if (r.created_at > item.lastChosenAt) item.lastChosenAt = r.created_at;
    }

    const items = Array.from(map.values())
      .sort((a, b) => b.votes - a.votes || (b.lastChosenAt > a.lastChosenAt ? 1 : -1))
      .slice(0, 10);

    return res.status(200).json({ items });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
