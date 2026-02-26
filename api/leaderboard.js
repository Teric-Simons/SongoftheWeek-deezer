import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });

  const { data, error } = await supabase
    .from("song_choices")
    .select("track_id,title,artist,album,cover_url,preview_url,votes,voters,created_at")
    .order("votes", { ascending: false })
    .order("created_at", { ascending: false })
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
    lastChosenAt: r.created_at,
  }));

  return res.status(200).json({ items });
}
