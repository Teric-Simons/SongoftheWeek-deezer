import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ORIGIN_ALLOW = "https://teric-simons.github.io"; // or "*" while testing

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", ORIGIN_ALLOW);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });

  try {
    const { data, error } = await supabase
      .from("song_choices")
      .select("track_id,title,artist,album,cover_url,preview_url,votes,voters,updated_at,created_at")
      .order("votes", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(10);

    if (error) return res.status(500).json({ error: error.message });

    const items = (data || []).map((r) => ({
      id: r.track_id,
      title: r.title,
      artist: r.artist,
      album: r.album,
      cover: r.cover_url,
      preview: r.preview_url,
      votes: r.votes ?? 0,
      voters: r.voters ?? [],
      lastUpdatedAt: r.updated_at ?? r.created_at,
    }));

    return res.status(200).json({ items });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
